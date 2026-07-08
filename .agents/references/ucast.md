# ucast

Repository: https://github.com/stalniy/ucast — "universal conditions AST": parses MongoDB-style
query objects into a condition AST and interprets it against various targets (JS objects, SQL, …).
Conceptually very close to rapiq (parse → condition AST → interpret/visit); its `@ucast/mongo`
package is the reference implementation for rapiq's mongo parser dialect
(`@rapiq/parser-mongo`, issue #701).

## Condition AST (`@ucast/core`)

| ucast (`packages/core/src/Condition.ts`) | rapiq (`packages/core/src/parameter/filters/`) | Differences |
|---|---|---|
| `FieldCondition { operator, field, value }` | `Filter { operator, field, value }` (`record/module.ts`) | rapiq operator names are unprefixed enum values (`FilterFieldOperator`); ucast strips the `$` via `operatorToConditionName` |
| `CompoundCondition { operator, value: Condition[] }` | `Filters { operator, value: ICondition[] }` (`collection/module.ts`) | ucast supports arbitrary compound names (`and`, `or`, `nor`, `not`); rapiq only `FilterCompoundOperator.AND/OR` |
| `DocumentCondition` (e.g. `$where`) | — | rapiq has no document-level conditions (and `$where` is a code-execution foot-gun; deliberately unsupported) |
| `NULL_CONDITION` sentinel (dropped by `pushIfNonNullCondition`) | — | rapiq parsers just don't emit a node (e.g. `$options` is consumed by its `$regex` sibling) |
| `optimizedCompoundCondition()` (`core/src/utils.ts`) — flattens same-operator nesting, unwraps single-child compounds | `Filters.flatten()` | rapiq's flatten does not unwrap single-child compounds |
| `ITSELF` field sentinel (elemMatch on scalar arrays) | — | rapiq `elemMatch` values are conditions with fields relative to the array element |

## Parsing (`@ucast/core` ObjectQueryParser + `@ucast/mongo`)

| ucast | rapiq | Differences |
|---|---|---|
| `ObjectQueryParser.parse()` (`core/src/parsers/ObjectQueryParser.ts`): per top-level key — registered compound/document instruction ⇒ recurse; value `hasOperators()` ⇒ per-`$op` field conditions; otherwise ⇒ `defaultOperatorName` (`$eq`); results merged with `buildAnd` | `MongoFiltersParser` (`packages/parser-mongo/src/parameter/filters/module.ts`) follows the same walk | rapiq resolves/validates every field path against a `Schema` via `ResolutionScope` (allow-lists, aliases, relation traversal, drop-vs-throw); ucast has no schema concept |
| Parsing "instructions" registry: `{ type: 'compound' \| 'field' \| 'document', validate?, parse? }` (`mongo/src/instructions.ts`), extensible by consumers | fixed operator tables in the parser (`$`-name → `FilterFieldOperator` + per-operator value validation) | rapiq's operator set is closed over `FilterFieldOperator` (visitor interfaces are typed per operator), so no user-extensible instruction registry |
| `hasOperators(value)` (`mongo/src/utils.ts`): object with at least one registered `$`-key | same idea: any own key starting with `$` marks an operator object | ucast checks against registered instructions; mixing operator and plain keys is an error in both |
| `MongoQueryParser.parse(query, { field })` — parse a field-operator object directly | — | rapiq parses whole filter parameters only |
| `MongoQuery<T>` recursive input type (`mongo/src/types.ts`) | `MongoFiltersParserInput<RECORD>` (`packages/parser-mongo/src/parameter/filters/types.ts`) | both type field keys/values from the record generic; rapiq keys come from `NestedKeys<T>` (depth-limited) |

## Operator semantics (`mongo/src/instructions.ts`)

- `$and`/`$or`: compound over a non-empty array of sub-queries (each must be a plain object);
  `$and`/`$or` use `optimizedCompoundCondition` (flatten), `$nor` builds a plain compound.
  rapiq: `$and`/`$or` map to `Filters(and|or)`; `$nor` has no AST form.
- `$not` (field level): value is a RegExp (→ negated `regex`) or operator object → parsed and
  wrapped in a `not` compound. rapiq has no `not` compound — the expression dialect's precedent
  is De Morgan operator negation (`eq↔ne`, `lt↔gte`, `in↔nin`, …).
- `$regex` + sibling `$options`: string is compiled to `new RegExp(value, $options)`; `$options`
  itself parses to `NULL_CONDITION` (consumed by the `$regex` instruction via `context.query`).
- `$elemMatch`: `hasOperators(value)` ? parse as field operators on `ITSELF` : parse as nested
  query; result nested inside a `FieldCondition`.
- Value validation throws plain `Error` (`ensureIs*` helpers); rapiq uses typed
  `FiltersParseError` + `ErrorCode` members instead.
- Operators with no rapiq AST equivalent: `$size`, `$all`, `$where`, `$type`.

## Interpretation

ucast interprets its AST with per-operator interpreter functions (`@ucast/js`, `@ucast/sql`,
`createInterpreter`); rapiq's equivalent is the visitor pattern (`IFilterVisitor` with optional
per-operator methods) consumed by `@rapiq/sql` / `@rapiq/typeorm`.
