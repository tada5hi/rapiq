//! Port of `@rapiq/parser-expression`'s `ExpressionFiltersParser`,
//! schemaless slice: tokenizer + recursive-descent parser producing
//! the filter [`Condition`] tree.
//!
//! Not ported: schema resolution, validate hooks, relation pruning,
//! index policies and issue traces. A failure is the abort the
//! TypeScript parser records as its trace's leaf issue (`syntaxInvalid`,
//! `keyInvalid`, `keyValueInvalid`); the `INPUT_REJECTED` envelope a
//! TypeScript `parse()` wraps around it is a trace concern.

use serde_json::Value;

use crate::error::{Error, Result};
use crate::ir::Condition;
use crate::number::{is_js_whitespace, js_string_to_number, js_trim, json_number};

/// `MAX_TRAVERSAL_DEPTH` of `@rapiq/core`.
pub const MAX_DEPTH: usize = 32;

/// `ITSELF` of `@rapiq/core`.
pub const ITSELF: &str = "$this";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokenKind {
    Not,
    And,
    Or,
    Equal,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    Contains,
    StartsWith,
    EndsWith,
    In,
    Nin,
    ElemMatch,
    Size,
    Field,
    Itself,
    EscapedText,
    Null,
    LParen,
    RParen,
    Comma,
    Dot,
    Eof,
}

impl TokenKind {
    /// The `FilterTokenType` value, used verbatim in error messages.
    fn as_str(self) -> &'static str {
        match self {
            TokenKind::Not => "NOT",
            TokenKind::And => "AND",
            TokenKind::Or => "OR",
            TokenKind::Equal => "eq",
            TokenKind::GreaterThan => "gt",
            TokenKind::GreaterOrEqual => "gte",
            TokenKind::LessThan => "lt",
            TokenKind::LessOrEqual => "lte",
            TokenKind::Contains => "like",
            TokenKind::StartsWith => "startsWith",
            TokenKind::EndsWith => "endsWith",
            TokenKind::In => "in",
            TokenKind::Nin => "nin",
            TokenKind::ElemMatch => "elemMatch",
            TokenKind::Size => "size",
            TokenKind::Field => "FIELD",
            TokenKind::Itself => "ITSELF",
            TokenKind::EscapedText => "ESCAPED_TEXT",
            TokenKind::Null => "NULL",
            TokenKind::LParen => "LPAREN",
            TokenKind::RParen => "RPAREN",
            TokenKind::Comma => "COMMA",
            TokenKind::Dot => "DOT",
            TokenKind::Eof => "EOF",
        }
    }

    fn keyword(word: &str) -> Option<Self> {
        Some(match word {
            "not" => TokenKind::Not,
            "and" => TokenKind::And,
            "or" => TokenKind::Or,
            "eq" => TokenKind::Equal,
            "gt" => TokenKind::GreaterThan,
            "gte" => TokenKind::GreaterOrEqual,
            "lt" => TokenKind::LessThan,
            "lte" => TokenKind::LessOrEqual,
            "contains" => TokenKind::Contains,
            "startsWith" => TokenKind::StartsWith,
            "endsWith" => TokenKind::EndsWith,
            "in" => TokenKind::In,
            "nin" => TokenKind::Nin,
            "elemMatch" => TokenKind::ElemMatch,
            "size" => TokenKind::Size,
            "null" => TokenKind::Null,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone)]
struct Token<'a> {
    kind: TokenKind,
    value: &'a str,
}

const EOF: Token<'static> = Token {
    kind: TokenKind::Eof,
    value: "",
};

/// Complement twins of the operator-semantics table (both directions).
fn complement_twin(operator: &str) -> Option<&'static str> {
    Some(match operator {
        "eq" => "ne",
        "ne" => "eq",
        "in" => "nin",
        "nin" => "in",
        "startsWith" => "notStartsWith",
        "notStartsWith" => "startsWith",
        "endsWith" => "notEndsWith",
        "notEndsWith" => "endsWith",
        "contains" => "notContains",
        "notContains" => "contains",
        _ => return None,
    })
}

/// `ExpressionFiltersParser.parse()` without a schema: an absent input
/// is an empty AND group, a root that is not an and/or group is
/// wrapped in one.
pub fn parse(input: Option<&str>) -> Result<Condition> {
    let Some(input) = input else {
        return Ok(Condition::compound("and", Vec::new()));
    };

    let expr = parse_exact(input)?;
    if matches!(expr.operator(), "and" | "or") && matches!(expr, Condition::Compound { .. }) {
        return Ok(expr);
    }

    Ok(Condition::compound("and", vec![expr]))
}

/// `ExpressionFiltersParser.parseExact()` without a schema: the raw
/// expression tree.
pub fn parse_exact(input: &str) -> Result<Condition> {
    let tokens = tokenize(input)?;
    let mut parser = Parser {
        tokens,
        pos: 0,
        elem_match_depth: 0,
    };

    let expr = parser.parse_filter_expression(0)?;
    let next = parser.peek().kind;
    if next != TokenKind::Eof {
        return Err(Error::syntax_invalid(format!(
            "Unexpected token: {}",
            next.as_str()
        )));
    }

    Ok(expr)
}

// -----------------------------------------------------------

fn is_segment_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

fn is_segment_inner_char(c: char) -> bool {
    is_segment_char(c) || c == '-'
}

fn unexpected_character(input: &str, byte_offset: usize) -> Error {
    // positions are reported in UTF-16 code units, like the JS cursor.
    let position = input[..byte_offset].encode_utf16().count();

    Error::syntax_invalid(format!("Unexpected character at position {position}."))
}

/// Length in bytes of the longest `'(?:''|[^'])*'` match at the start
/// of `rest` (which begins with the opening quote), mirroring the
/// backtracking a regex engine performs on an unterminated pair.
fn quoted_length(rest: &str) -> Option<usize> {
    let bytes = rest.as_bytes();
    let mut i = 1;
    let mut last_close: Option<usize> = None;

    loop {
        if i >= bytes.len() {
            return last_close;
        }

        if bytes[i] == b'\'' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'\'' {
                last_close = Some(i + 1);
                i += 2;
                continue;
            }

            return Some(i + 1);
        }

        i += 1;
    }
}

fn tokenize(input: &str) -> Result<Vec<Token<'_>>> {
    let mut tokens = Vec::new();
    let mut cursor = 0;

    while cursor < input.len() {
        let rest = &input[cursor..];
        let c = rest.chars().next().expect("non-empty remainder");

        if is_js_whitespace(c) {
            let length = rest
                .char_indices()
                .find(|(_, c)| !is_js_whitespace(*c))
                .map_or(rest.len(), |(i, _)| i);
            cursor += length;
            continue;
        }

        let single = match c {
            '(' => Some(TokenKind::LParen),
            ')' => Some(TokenKind::RParen),
            ',' => Some(TokenKind::Comma),
            '.' => Some(TokenKind::Dot),
            _ => None,
        };
        if let Some(kind) = single {
            tokens.push(Token { kind, value: "" });
            cursor += 1;
            continue;
        }

        if c == '\'' {
            let Some(length) = quoted_length(rest) else {
                return Err(unexpected_character(input, cursor));
            };

            tokens.push(Token {
                kind: TokenKind::EscapedText,
                value: &rest[..length],
            });
            cursor += length;
            continue;
        }

        if c == '$' {
            // $-words are reserved markers, never field segments.
            let length = 1 + rest[1..]
                .find(|c: char| !is_segment_char(c))
                .unwrap_or(rest.len() - 1);
            let marker = &rest[..length];
            if marker != ITSELF {
                return Err(Error::syntax_invalid(format!(
                    "The marker {marker} is unknown."
                )));
            }

            tokens.push(Token {
                kind: TokenKind::Itself,
                value: marker,
            });
            cursor += length;
            continue;
        }

        if is_segment_char(c) {
            // [A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])? : greedy run,
            // then give back trailing dashes.
            let mut length = rest
                .find(|c: char| !is_segment_inner_char(c))
                .unwrap_or(rest.len());
            while rest.as_bytes()[length - 1] == b'-' {
                length -= 1;
            }

            let word = &rest[..length];

            // keywords are classified from whole identifiers, so an
            // identifier merely starting with one (order) stays a field.
            let kind = TokenKind::keyword(word).unwrap_or(TokenKind::Field);
            tokens.push(Token { kind, value: word });
            cursor += length;
            continue;
        }

        return Err(unexpected_character(input, cursor));
    }

    tokens.push(EOF);

    Ok(tokens)
}

// -----------------------------------------------------------

struct Parser<'a> {
    tokens: Vec<Token<'a>>,
    pos: usize,
    elem_match_depth: usize,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> &Token<'a> {
        self.tokens.get(self.pos).unwrap_or(&EOF)
    }

    fn consume(&mut self) -> Token<'a> {
        let token = self.peek().clone();
        self.pos += 1;
        token
    }

    fn expect(&mut self, expected: TokenKind) -> Result<Token<'a>> {
        let token = self.peek().clone();
        if token.kind != expected {
            return Err(Error::syntax_invalid(format!(
                "Expected {}, got {}",
                expected.as_str(),
                token.kind.as_str()
            )));
        }

        self.pos += 1;
        Ok(token)
    }

    fn parse_filter_expression(&mut self, depth: usize) -> Result<Condition> {
        if depth > MAX_DEPTH {
            return Err(Error::syntax_invalid(
                "The maximum nesting depth was exceeded.",
            ));
        }

        match self.peek().kind {
            TokenKind::Not => self.parse_not_expression(depth),
            TokenKind::And | TokenKind::Or => self.parse_logical_expression(depth),
            TokenKind::Equal
            | TokenKind::GreaterThan
            | TokenKind::GreaterOrEqual
            | TokenKind::LessThan
            | TokenKind::LessOrEqual => self.parse_comparison_expression(),
            TokenKind::Contains | TokenKind::StartsWith | TokenKind::EndsWith => {
                self.parse_match_expression()
            }
            TokenKind::In | TokenKind::Nin => self.parse_in_expression(),
            TokenKind::ElemMatch => self.parse_elem_match_expression(depth),
            TokenKind::Size => self.parse_size_expression(),
            other => Err(Error::syntax_invalid(format!(
                "Unexpected token in filter expression: {}",
                other.as_str()
            ))),
        }
    }

    /// not(expr): a single leaf with a complement twin normalizes to
    /// the twin, a double negation cancels, everything else stays a
    /// first-class NOT node.
    fn parse_not_expression(&mut self, depth: usize) -> Result<Condition> {
        self.expect(TokenKind::Not)?;
        self.expect(TokenKind::LParen)?;
        let expr = self.parse_filter_expression(depth + 1)?;
        self.expect(TokenKind::RParen)?;

        match expr {
            Condition::Leaf {
                operator,
                field,
                value,
            } => match complement_twin(&operator) {
                Some(twin) => Ok(Condition::Leaf {
                    operator: twin.to_string(),
                    field,
                    value,
                }),
                None => Ok(Condition::compound(
                    "not",
                    vec![Condition::Leaf {
                        operator,
                        field,
                        value,
                    }],
                )),
            },
            Condition::Compound {
                operator,
                mut children,
            } => {
                if operator == "not" && children.len() == 1 {
                    return Ok(children.remove(0));
                }

                Ok(Condition::compound(
                    "not",
                    vec![Condition::Compound { operator, children }],
                ))
            }
            // the grammar never produces one; kept total for the type.
            custom @ Condition::Custom { .. } => Ok(Condition::compound("not", vec![custom])),
        }
    }

    fn parse_logical_expression(&mut self, depth: usize) -> Result<Condition> {
        let operator = match self.consume().kind {
            TokenKind::And => "and",
            TokenKind::Or => "or",
            _ => return Err(Error::syntax_invalid("Expected AND or OR token type.")),
        };

        self.expect(TokenKind::LParen)?;
        let mut expressions = vec![self.parse_filter_expression(depth + 1)?];
        while self.peek().kind == TokenKind::Comma {
            self.expect(TokenKind::Comma)?;
            expressions.push(self.parse_filter_expression(depth + 1)?);
        }
        self.expect(TokenKind::RParen)?;

        Ok(Condition::compound(operator, expressions))
    }

    fn parse_comparison_expression(&mut self) -> Result<Condition> {
        let kind = self.consume().kind;
        self.expect(TokenKind::LParen)?;
        let field = self.parse_field_chain()?;
        self.expect(TokenKind::Comma)?;
        let value = self.parse_value()?;
        self.expect(TokenKind::RParen)?;

        let operator = match kind {
            TokenKind::Equal => "eq",
            TokenKind::GreaterThan => "gt",
            TokenKind::GreaterOrEqual => "gte",
            TokenKind::LessThan => "lt",
            TokenKind::LessOrEqual => "lte",
            other => {
                return Err(Error::syntax_invalid(format!(
                    "Token type {} not supported as comparison operator.",
                    other.as_str()
                )));
            }
        };

        Ok(Condition::leaf(operator, field, value))
    }

    fn parse_match_expression(&mut self) -> Result<Condition> {
        let kind = self.consume().kind;
        self.expect(TokenKind::LParen)?;
        let field = self.parse_field_chain()?;
        self.expect(TokenKind::Comma)?;
        let text = self.expect(TokenKind::EscapedText)?.value;
        self.expect(TokenKind::RParen)?;

        // the anchored operators match a literal substring: the pattern
        // is kept verbatim, never run through the scalar grammar.
        let normalized = unquote(text);

        let operator = match kind {
            TokenKind::Contains => "contains",
            TokenKind::EndsWith => "endsWith",
            _ => "startsWith",
        };

        Ok(Condition::leaf(operator, field, Value::String(normalized)))
    }

    fn parse_in_expression(&mut self) -> Result<Condition> {
        let negated = self.peek().kind == TokenKind::Nin;
        self.consume();
        self.expect(TokenKind::LParen)?;

        let field = self.parse_field_chain()?;

        let mut values = Vec::new();
        while self.peek().kind == TokenKind::Comma {
            self.expect(TokenKind::Comma)?;
            values.push(self.parse_value()?);
        }
        self.expect(TokenKind::RParen)?;

        let operator = if negated { "nin" } else { "in" };

        Ok(Condition::leaf(operator, field, Value::Array(values)))
    }

    /// size(field, n): n must coerce to a non-negative safe integer.
    fn parse_size_expression(&mut self) -> Result<Condition> {
        self.expect(TokenKind::Size)?;
        self.expect(TokenKind::LParen)?;
        let field = self.parse_field_chain()?;
        self.expect(TokenKind::Comma)?;
        let value = self.parse_value()?;
        self.expect(TokenKind::RParen)?;

        let valid = value
            .as_f64()
            .is_some_and(|n| n >= 0.0 && n.fract() == 0.0 && n <= 9_007_199_254_740_991.0);
        if !valid {
            return Err(Error::key_value_invalid(&field));
        }

        Ok(Condition::leaf("size", field, value))
    }

    /// elemMatch(field, expr): paths inside the interior are relative
    /// to the array element; ITSELF addresses the element itself.
    fn parse_elem_match_expression(&mut self, depth: usize) -> Result<Condition> {
        self.expect(TokenKind::ElemMatch)?;
        self.expect(TokenKind::LParen)?;

        let field = if self.peek().kind == TokenKind::Itself {
            self.parse_field_chain()?
        } else {
            self.parse_plain_chain()?
        };

        self.expect(TokenKind::Comma)?;

        self.elem_match_depth += 1;
        let condition = self.parse_filter_expression(depth + 1);
        self.elem_match_depth -= 1;
        let condition = condition?;

        self.expect(TokenKind::RParen)?;

        Ok(Condition::elem_match(field, condition))
    }

    fn parse_plain_chain(&mut self) -> Result<String> {
        let mut parts = vec![self.expect(TokenKind::Field)?.value];
        while self.peek().kind == TokenKind::Dot {
            self.expect(TokenKind::Dot)?;
            parts.push(self.expect(TokenKind::Field)?.value);
        }

        Ok(parts.join("."))
    }

    fn parse_field_chain(&mut self) -> Result<String> {
        if self.peek().kind == TokenKind::Itself {
            self.consume();

            // the marker addresses the element bound by the enclosing
            // elemMatch interior; outside one it has no referent.
            if self.elem_match_depth == 0 {
                return Err(Error::key_invalid(ITSELF));
            }

            return Ok(ITSELF.to_string());
        }

        self.parse_plain_chain()
    }

    fn parse_value(&mut self) -> Result<Value> {
        let token = self.consume();
        match token.kind {
            TokenKind::EscapedText => Ok(normalize_value(token.value)),
            TokenKind::Null => Ok(Value::Null),
            other => Err(Error::syntax_invalid(format!(
                "Unexpected token in value: {}",
                other.as_str()
            ))),
        }
    }
}

/// Strip the surrounding quotes and collapse doubled ones.
fn unquote(text: &str) -> String {
    if text.len() >= 2 {
        text[1..text.len() - 1].replace("''", "'")
    } else {
        text.to_string()
    }
}

/// `normalizeValue` of the expression parser for a quoted token: the
/// content is coerced, never comma-split.
fn normalize_value(raw: &str) -> Value {
    let trimmed = js_trim(raw);
    if trimmed.len() >= 2 && trimmed.starts_with('\'') && trimmed.ends_with('\'') {
        return parse_filter_scalar(&unquote(trimmed));
    }

    parse_filter_scalar(trimmed)
}

/// `parseFilterScalar` of `@rapiq/parser-simple`: booleans and null
/// case-insensitively, then `Number()`, otherwise the trimmed string.
///
/// Divergence: a literal coercing to a non-finite number (`Infinity`)
/// has no JSON form, so it stays a string here (TypeScript yields the
/// number `Infinity`, which `JSON.stringify` writes as `null`).
pub fn parse_filter_scalar(input: &str) -> Value {
    let trimmed = js_trim(input);
    if trimmed.is_empty() {
        return Value::String(String::new());
    }

    match trimmed.to_lowercase().as_str() {
        "true" => return Value::Bool(true),
        "false" => return Value::Bool(false),
        "null" => return Value::Null,
        _ => {}
    }

    let number = js_string_to_number(trimmed);
    if !number.is_nan()
        && let Some(value) = json_number(number)
    {
        return value;
    }

    Value::String(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use serde_json::json;

    fn exact(input: &str) -> Value {
        parse_exact(input).unwrap().to_json()
    }

    #[test]
    fn parses_leaves_and_groups() {
        assert_eq!(
            exact("eq(name, 'admin')"),
            json!({ "type": "filter", "operator": "eq", "field": "name", "value": "admin" })
        );
        assert_eq!(
            parse(Some("and(eq(name, 'admin'), eq(age, '18'))"))
                .unwrap()
                .to_json(),
            json!({ "type": "filters", "operator": "and", "value": [
                { "type": "filter", "operator": "eq", "field": "name", "value": "admin" },
                { "type": "filter", "operator": "eq", "field": "age", "value": 18 },
            ] })
        );
    }

    #[test]
    fn normalizes_negation() {
        assert_eq!(exact("not(eq(name, 'a'))")["operator"], "ne");
        assert_eq!(exact("not(not(eq(name, 'a')))")["operator"], "eq");
        assert_eq!(exact("not(gt(age, '1'))")["operator"], "not");
    }

    #[test]
    fn keeps_identifiers_that_start_with_a_keyword() {
        assert_eq!(exact("eq(order, '1')")["field"], "order");
    }

    #[test]
    fn rejects_bad_syntax() {
        for input in [
            "eq(name 'a')",
            "eq(name, 'a'",
            "",
            "eq(name, 'a'))",
            "eq(na me, 'x')",
        ] {
            assert_eq!(
                parse_exact(input).unwrap_err().code,
                ErrorCode::SyntaxInvalid,
                "{input}"
            );
        }
    }

    #[test]
    fn rejects_itself_outside_elem_match() {
        assert_eq!(
            parse_exact("eq($this, '5')").unwrap_err().code,
            ErrorCode::KeyInvalid
        );
        assert_eq!(
            exact("elemMatch(scores, gt($this, '5'))")["value"]["field"],
            "$this"
        );
    }

    #[test]
    fn enforces_the_depth_cap() {
        let deep = format!("{}eq(a, '1'){}", "not(".repeat(40), ")".repeat(40));
        assert_eq!(
            parse_exact(&deep).unwrap_err().code,
            ErrorCode::SyntaxInvalid
        );
    }
}
