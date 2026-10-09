//! Port of `@rapiq/adapter-memory`'s filter compiler and binding
//! enumeration: a plan is compiled once into a node tree, which is then
//! evaluated per record.
//!
//! Dotted paths over arrays use LEFT-join row semantics: a record
//! matches when some assignment of array elements to the referenced
//! relation paths satisfies the whole tree, so conditions sharing a
//! path bind to the same element. Every elemMatch opens its own
//! quantifier scope.

use std::collections::HashMap;

use regex::{Regex, RegexBuilder};
use serde_json::Value;

use crate::error::{Error, Result};
use crate::expression::ITSELF;
use crate::ir::Condition;
use crate::plan::{CompareOp, MatchPattern, Plan, PlanOptions, plan_condition};
use crate::value::{compare_values, is_value_equal, resolve_property, to_text};

static NULL: Value = Value::Null;

/// Separates a binding-path segment's property name from the elemMatch
/// scope discriminator; the NUL byte keeps discriminated segments out
/// of the real property namespace.
const BINDING_SCOPE_SEPARATOR: char = '\u{0}';

#[derive(Debug)]
enum Node {
    And(Vec<Node>),
    Or(Vec<Node>),
    Not(Box<Node>),
    Constant(bool),
    Leaf {
        access: Access,
        test: Test,
        negated: bool,
    },
}

#[derive(Debug)]
enum Access {
    Root(String),
    Bound { slot: usize, name: String },
    Itself { slot: usize },
}

#[derive(Debug)]
struct EqualTest {
    value: Value,
    /// The lowered condition string when the case-fold verdict holds.
    folded: Option<String>,
}

impl EqualTest {
    fn new(value: &Value, case_fold: bool) -> Self {
        let folded = match value {
            Value::String(s) if case_fold => Some(s.to_lowercase()),
            _ => None,
        };

        Self {
            value: value.clone(),
            folded,
        }
    }

    fn test(&self, value: &Value) -> bool {
        if let (Some(folded), Value::String(s)) = (&self.folded, value) {
            // ASCII fast path: identical to the full Unicode lowering
            // for ASCII input, without allocating.
            if s.is_ascii() && folded.is_ascii() {
                return s.eq_ignore_ascii_case(folded);
            }

            return s.to_lowercase() == *folded;
        }

        is_value_equal(value, &self.value)
    }
}

#[derive(Debug)]
enum Test {
    IsNull {
        elementwise: bool,
    },
    Equal(EqualTest),
    Compare {
        value: Value,
        min: i8,
        max: i8,
    },
    OneOf {
        tests: Vec<EqualTest>,
        includes_null: bool,
    },
    Match(Regex),
    Mod {
        divisor: f64,
        remainder: f64,
    },
    Size(Option<usize>),
}

/// Positive leaf tests treat an array value by element.
fn any_value(value: &Value, test: impl Fn(&Value) -> bool) -> bool {
    match value {
        Value::Array(items) => items.iter().any(test),
        other => test(other),
    }
}

impl Test {
    fn test(&self, value: &Value) -> bool {
        match self {
            Test::IsNull { elementwise: true } => any_value(value, Value::is_null),
            Test::IsNull { elementwise: false } => value.is_null(),
            Test::Equal(equal) => any_value(value, |v| equal.test(v)),
            Test::Compare {
                value: condition,
                min,
                max,
            } => any_value(value, |v| {
                compare_values(v, condition).is_some_and(|ordering| {
                    let result = ordering as i8;
                    result >= *min && result <= *max
                })
            }),
            Test::OneOf {
                tests,
                includes_null,
            } => any_value(value, |v| {
                tests.iter().any(|t| t.test(v)) || (*includes_null && v.is_null())
            }),
            Test::Match(regex) => any_value(value, |v| {
                to_text(v).is_some_and(|text| regex.is_match(&text))
            }),
            Test::Mod { divisor, remainder } => any_value(value, |v| {
                v.as_f64().is_some_and(|n| n % divisor == *remainder)
            }),
            // the condition addresses the array itself, not its elements.
            Test::Size(count) => match (count, value) {
                (Some(count), Value::Array(items)) => items.len() == *count,
                _ => false,
            },
        }
    }
}

#[derive(Debug)]
struct Slot {
    parent: Option<usize>,
    /// Property the slot reads off its parent binding, or `None` for an
    /// ITSELF segment (an elemMatch on the element itself).
    name: Option<String>,
}

/// A compiled filter predicate.
#[derive(Debug)]
pub struct Predicate {
    root: Option<Node>,
    slots: Vec<Slot>,
    /// Slot ids in enumeration order (every path after its prefix).
    order: Vec<usize>,
}

impl Predicate {
    pub fn compile(input: &Condition, options: &PlanOptions) -> Result<Self> {
        let Some(plan) = plan_condition(input, options)? else {
            return Ok(Self {
                root: None,
                slots: Vec::new(),
                order: Vec::new(),
            });
        };

        let mut compiler = Compiler::default();
        let root = compiler.compile(&plan)?;

        let mut order: Vec<usize> = (0..compiler.paths.len()).collect();
        order.sort_by(|a, b| compiler.paths[*a].cmp(&compiler.paths[*b]));

        Ok(Self {
            root: Some(root),
            slots: compiler.slots,
            order,
        })
    }

    pub fn test(&self, input: &Value) -> bool {
        let Some(root) = &self.root else {
            return true;
        };

        // binding slots live on the stack for the common case.
        const INLINE: usize = 8;
        let count = self.slots.len();
        if count <= INLINE {
            let mut values = [&NULL; INLINE];
            let mut elements = [false; INLINE];
            let mut ctx = Context {
                values: &mut values[..count],
                elements: &mut elements[..count],
            };

            return self.enumerate(root, input, &mut ctx, 0);
        }

        let mut values = vec![&NULL; count];
        let mut elements = vec![false; count];
        let mut ctx = Context {
            values: &mut values,
            elements: &mut elements,
        };

        self.enumerate(root, input, &mut ctx, 0)
    }

    fn enumerate<'a>(
        &self,
        root: &Node,
        input: &'a Value,
        ctx: &mut Context<'a, '_>,
        index: usize,
    ) -> bool {
        if index == self.order.len() {
            return evaluate(root, input, ctx);
        }

        let id = self.order[index];
        let slot = &self.slots[id];
        let parent = slot.parent.map_or(input, |p| ctx.values[p]);
        let raw = match &slot.name {
            Some(name) => resolve_property(parent, name),
            None => parent,
        };

        // ITSELF leaves only match real array elements.
        ctx.elements[id] = matches!(raw, Value::Array(items) if !items.is_empty());

        match raw {
            Value::Array(items) if !items.is_empty() => {
                for item in items {
                    ctx.values[id] = item;
                    if self.enumerate(root, input, ctx, index + 1) {
                        return true;
                    }
                }

                false
            }
            // an absent value or an empty array contributes one NULL row.
            Value::Array(_) => {
                ctx.values[id] = &NULL;
                self.enumerate(root, input, ctx, index + 1)
            }
            other => {
                ctx.values[id] = other;
                self.enumerate(root, input, ctx, index + 1)
            }
        }
    }
}

struct Context<'a, 's> {
    values: &'s mut [&'a Value],
    elements: &'s mut [bool],
}

fn evaluate(node: &Node, input: &Value, ctx: &Context<'_, '_>) -> bool {
    match node {
        Node::And(children) => children.iter().all(|c| evaluate(c, input, ctx)),
        Node::Or(children) => children.iter().any(|c| evaluate(c, input, ctx)),
        Node::Not(child) => !evaluate(child, input, ctx),
        Node::Constant(verdict) => *verdict,
        Node::Leaf {
            access,
            test,
            negated,
        } => match access {
            Access::Root(key) => test.test(resolve_property(input, key)) != *negated,
            Access::Bound { slot, name } => {
                test.test(resolve_property(ctx.values[*slot], name)) != *negated
            }
            Access::Itself { slot } => {
                ctx.elements[*slot] && (test.test(ctx.values[*slot]) != *negated)
            }
        },
    }
}

// -----------------------------------------------------------

#[derive(Default)]
struct Compiler {
    paths: Vec<String>,
    ids: HashMap<String, usize>,
    slots: Vec<Slot>,
    binding_prefix: String,
    scope_sequence: usize,
}

impl Compiler {
    fn compile(&mut self, plan: &Plan) -> Result<Node> {
        Ok(match plan {
            Plan::Compound {
                or,
                negated,
                children,
            } => {
                let children = children
                    .iter()
                    .map(|c| self.compile(c))
                    .collect::<Result<Vec<_>>>()?;
                let node = if *or {
                    Node::Or(children)
                } else {
                    Node::And(children)
                };

                if *negated {
                    Node::Not(Box::new(node))
                } else {
                    node
                }
            }
            Plan::Constant(verdict) => Node::Constant(*verdict),
            Plan::NullCheck {
                field,
                negated,
                elementwise,
            } => self.leaf(
                field,
                Test::IsNull {
                    elementwise: *elementwise,
                },
                *negated,
            )?,
            Plan::Compare {
                field,
                op: CompareOp::Eq,
                value,
                case_fold,
                negated,
            } => self.leaf(
                field,
                Test::Equal(EqualTest::new(value, *case_fold)),
                *negated,
            )?,
            Plan::Compare {
                field, op, value, ..
            } => {
                let (min, max) = op.range();
                self.leaf(
                    field,
                    Test::Compare {
                        value: value.clone(),
                        min,
                        max,
                    },
                    false,
                )?
            }
            Plan::OneOf {
                field,
                values,
                includes_null,
                case_fold,
                negated,
            } => self.leaf(
                field,
                Test::OneOf {
                    tests: values
                        .iter()
                        .map(|v| EqualTest::new(v, *case_fold))
                        .collect(),
                    includes_null: *includes_null,
                },
                *negated,
            )?,
            Plan::Match {
                field,
                pattern,
                ignore_case,
                negated,
                ..
            } => self.leaf(
                field,
                Test::Match(build_regex(pattern, *ignore_case)?),
                *negated,
            )?,
            Plan::Mod {
                field,
                divisor,
                remainder,
            } => self.leaf(
                field,
                Test::Mod {
                    divisor: *divisor,
                    remainder: *remainder,
                },
                false,
            )?,
            Plan::Size { field, count } => self.leaf(field, Test::Size(*count), false)?,
            Plan::ElemMatch { field, condition } => {
                self.scope_sequence += 1;
                let prefix = format!(
                    "{}{field}{BINDING_SCOPE_SEPARATOR}{}.",
                    self.binding_prefix, self.scope_sequence
                );
                let old = std::mem::replace(&mut self.binding_prefix, prefix);

                let node = self.compile(condition);
                self.binding_prefix = old;

                node?
            }
        })
    }

    fn leaf(&mut self, field: &str, test: Test, negated: bool) -> Result<Node> {
        let access = if field == ITSELF {
            if self.binding_prefix.is_empty() {
                return Err(Error::feature_unsupported("filters:itself"));
            }

            let path = self.binding_prefix[..self.binding_prefix.len() - 1].to_string();
            Access::Itself {
                slot: self.register_path(&path),
            }
        } else {
            let key = format!("{}{field}", self.binding_prefix);
            match key.rfind('.') {
                None => Access::Root(key),
                Some(index) => Access::Bound {
                    slot: self.register_path(&key[..index]),
                    name: key[index + 1..].to_string(),
                },
            }
        };

        Ok(Node::Leaf {
            access,
            test,
            negated,
        })
    }

    /// Register a binding path and all of its prefixes; returns the
    /// slot id of the path itself.
    fn register_path(&mut self, path: &str) -> usize {
        let mut parent: Option<usize> = None;
        let mut end = 0;

        for segment in path.split('.') {
            end += segment.len();
            let prefix = &path[..end];
            end += 1;

            let id = match self.ids.get(prefix) {
                Some(id) => *id,
                None => {
                    let name = segment
                        .split(BINDING_SCOPE_SEPARATOR)
                        .next()
                        .unwrap_or(segment);
                    let id = self.paths.len();
                    self.paths.push(prefix.to_string());
                    self.ids.insert(prefix.to_string(), id);
                    self.slots.push(Slot {
                        parent,
                        name: (name != ITSELF).then(|| name.to_string()),
                    });
                    id
                }
            };

            parent = Some(id);
        }

        parent.expect("a path has at least one segment")
    }
}

fn build_regex(pattern: &MatchPattern, ignore_case: bool) -> Result<Regex> {
    let invalid = || Error::feature_unsupported("filters:regex:value");

    let mut builder = match pattern {
        MatchPattern::Starts(text) => RegexBuilder::new(&format!("^{}", regex::escape(text))),
        MatchPattern::Ends(text) => RegexBuilder::new(&format!("{}$", regex::escape(text))),
        MatchPattern::Contains(text) => RegexBuilder::new(&regex::escape(text)),
        MatchPattern::Regex { source, .. } => RegexBuilder::new(source),
    };

    match pattern {
        MatchPattern::Regex { flags, .. } => {
            for flag in flags.chars() {
                match flag {
                    'i' => {
                        builder.case_insensitive(true);
                    }
                    'm' => {
                        builder.multi_line(true);
                    }
                    's' => {
                        builder.dot_matches_new_line(true);
                    }
                    // stateful and unicode-mode flags carry no matching
                    // semantics for a single test.
                    'g' | 'y' | 'u' | 'v' | 'd' => {}
                    _ => return Err(invalid()),
                }
            }
        }
        _ => {
            builder.case_insensitive(ignore_case);
        }
    }

    builder.build().map_err(|_| invalid())
}
