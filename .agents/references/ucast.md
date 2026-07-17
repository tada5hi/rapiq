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
| `ITSELF` field sentinel (elemMatch on scalar arrays) | `ITSELF = '$this'` (`core/src/parameter/filters/constants.ts`, plan 016) | ucast uses a symbol; rapiq uses a reserved token string so the marker survives codec round-trips (expression wire form `elemMatch(scores,gt($this,'5'))`) |

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
  query; result nested inside a `FieldCondition`. rapiq mirrors the split since plan 016
  (`MongoFiltersParser.buildElemMatch`: any `MONGO_FIELD_OPERATORS` key → element-level form on
  `ITSELF`).
- Value validation throws plain `Error` (`ensureIs*` helpers); rapiq uses typed
  `FiltersParseError` + `ErrorCode` members instead.
- `$all`: ucast keeps it as its own condition; rapiq desugars it to an AND of independently
  scoped `elemMatch(f, eq(ITSELF, v))` conditions (plan 016 Q4, no dedicated operator).
- Operators with no rapiq AST equivalent: `$size`, `$where`, `$type`.

## Interpretation

ucast interprets its AST with per-operator interpreter functions (`@ucast/js`, `@ucast/sql`,
`createInterpreter`); rapiq's equivalent is the visitor pattern (`IFilterVisitor` with optional
per-operator methods) consumed by `@rapiq/sql` / `@rapiq/typeorm` / `@rapiq/memory`.

## In-memory evaluation (`@ucast/js` ↔ `@rapiq/memory`)

`@ucast/js` is the reference implementation behind `@rapiq/memory` (plan 014); the maintainer
explicitly rejected its interpreter-registry shape in favor of the core visitor interfaces.

| ucast (`packages/js/src/`) | rapiq (`packages/memory/src/`) | Differences |
|---|---|---|
| `createJsInterpreter(operators, {get, compare})` → `interpret(condition, object)` | `FiltersVisitor`/`FiltersCompiler` (`parameter/filters/`), `compileFilters(condition)` → `Predicate` | rapiq compiles once to a reusable closure; extension = subclass `FiltersCompiler`, not an options bag |
| interpreter registry (record of functions, unregistered op throws plain `Error`) | per-operator `visitFilterX` methods; `visitFilter` fallback throws `AdapterError.operatorUnsupported` | closed operator set over `FilterFieldOperator` |
| `getObjectField`/`getValueByPath` (dot paths; array parent → map+**flatten**; numeric segments index arrays; `ITSELF` sentinel) | join-row binding (`parameter/filters/binding.ts`): dotted prefixes = relation paths, ∃-DFS binds one element per path (SQL LEFT-join parity); leaf lookup is own-property only; ITSELF leaves read the bound element (real array elements only, plan 016 Q5) | ucast quantifies each leaf independently; rapiq binds same-element across dotted paths (plan 014 Q4) but every `elemMatch` opens its own quantifier scope (plan 016 Q3, mongo parity). No numeric-index segments |
| `eq` (whole-array equality ∨ membership; RegExp value acts as pattern; null matches missing own-prop) | `buildEqualTest` (`parameter/filters/compiler.ts`): strict equality after null-unification, Date by `getTime`, array leaf → membership only | no whole-array equality, no RegExp-as-eq-value; `undefined` ≡ `null` (ucast: explicit `undefined` does NOT match null) |
| `ne`/`nin` = `!eq`/`!within` (complement) | same complement law (plan 014 Q3) | agreement — this is where rapiq deviates from SQL 3VL instead |
| `exists` = `hasOwn` (undefined-valued key exists) | `exists` = is-not-null | SQL parity beats mongo presence semantics |
| `regex` resets `lastIndex` around `.test()` | compiled `RegExp` rebuilt without `g`/`y` flags | same goal, compile-time fix |
| contains-family: none (regex only) | `contains/startsWith/endsWith` ± negation via core `createFilterRegex` (case-insensitive, literal-escaped) | rapiq extension operators |
| no projection/sort/pagination | `FieldsVisitor` keep-tree, `SortsVisitor`, `PaginationVisitor`, `CompiledQuery.apply` | ucast is conditions-only; rapiq covers all five parameters |
