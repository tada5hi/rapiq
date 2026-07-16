# v2 Migration Notes (running ledger)

Behavior changes vs v1 / earlier v2-alpha, logged **when introduced** (roadmap cross-cutting rule).
Plan 009 converts this ledger into the docs migration guide.

## ResolutionScope refactor (issue #726)

Key/alias/allow-list/relation-path resolution moved into `ResolutionScope`
(`@rapiq/core`, `src/schema/resolver/`). The five `Base*Parser` classes were
**removed** from the public API; parsers extend `BaseParser` directly.

Error taxonomy & policy:

1. Sort relation failures throw `SortParseError` (previously `FiltersParseError`; message unchanged).
2. Filters & relations disallowed keys throw `keyNotPermitted` / `ErrorCode.KEY_NOT_ALLOWED` (previously `keyInvalid` / `KEY_INVALID`). Fields open-schema pattern failures now throw `keyInvalid` (previously `keyNotPermitted`).
3. `SimpleRelationsParser` input-shape failures throw `RelationsParseError` (previously `SortParseError` — copy-paste bug).
4. `FieldsParseOptions` and `PaginationParseOptions` gained `throwOnFailure`; the effective policy is uniformly `options.throwOnFailure ?? schema.throwOnFailure ?? false` and the context override is inherited into relation recursion.

Resolution semantics:

5. Alias `mapping` now applies to relation prefixes/segments in every parameter (previously leaf names only, except the relations parser); relation output prefixes use the mapped segment.
6. `schemaMapping` is honored when a schema is passed as an unregistered `Schema` instance (resolved the four `// todo: also pass options.schema`).
7. Fields: an unresolvable relation schema under a bound schema now drops/throws the subtree (previously recursed permissively due to a missing `continue`).
8. Unbound scopes (parse without any schema) descend permissively for all parameters — schemaless dotted keys now survive sort/filters parsing (previously dropped); required for codec round-trips. Bound schemas without a resolvable child still drop/throw (`SCHEMA_UNRESOLVABLE`), except the relations parameter, whose child schemas remain optional refinements.
9. Expression parser (schema-constrained mode): the leading segment is skipped only when it *equals* the schema name (or `DEFAULT_ID`) and is now stripped from the output field (mirrors simple-parser named-group hoisting); alias mapping is applied; unresolvable relation segments always throw `keyPathInvalid`. Without a schema, expression parsing remains unvalidated.
10. Alias mappings whose target contains dots (`mapping: { realmName: 'realm.name' }`) resolve through relation traversal: every segment is walked (per-level relations gate + registry/schemaMapping lookup) and the leaf validates against the *related* schema instead of the root allow-list — matching what direct dotted input always did. The emitted field keeps the full mapped path. In the fields parser such aliases are requeued through the relation machinery (child `execute()` semantics apply) and duplicate field nodes are deduplicated by name. Relation traversal is bounded (32 levels): cyclic mapping/schemaMapping configurations yield a `schemaUnresolvable` verdict (or `keyPathInvalid` under `throwOnFailure`) instead of unbounded recursion.
11. `SimpleParser.parse` / `ExpressionParser.parse` without a schema no longer bind the parameter parsers to a manufactured empty schema — schemaless parsing is uniformly unconstrained (dotted keys survive), consistent with `URLCodec.decode()`.

`BaseParser.expandObject` now creates a fresh child object for nested input. Earlier v2 builds self-referenced the parent accumulator for input such as `{ user: { name: 'x' } }`, causing infinite recursion.

## 2.0.0-beta hardening

- Filter schema `validate` hooks run for every parsed leaf in the simple, expression and Mongo dialects — including the interior conditions of `$elemMatch` (validated inside-out, then the rebuilt `elemMatch` leaf itself). They may return the original/replacement filter or `undefined` to reject it (the `Validator` type deliberately excludes `void`: an inspect-only hook must `return` the filter). A compound whose every leaf is rejected is pruned entirely, so schema defaults apply even for nested input. Hooks may be async: `parse()` stays synchronous and throws `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER` on a Promise; `parseAsync()` awaits sequentially in tree order. Because schema-aware encode pipes through the schema-bound decoder, validators should be idempotent.
- Expression filters reject every unmatched source character, preserve leading underscores and cap recursive compounds/negations at the shared `MAX_TRAVERSAL_DEPTH` (32, exported from `@rapiq/core`). The Mongo parser and the schema resolver consume the same constant.
- `regex(field, pattern)` accepts `RegExp` or string in memory and SQL backends. `@rapiq/memory` compiles strings via `new RegExp` and throws typed `AdapterError` on invalid patterns; `@rapiq/sql` passes strings through unchanged so the database engine owns regex syntax and validation. Values that are neither `RegExp` nor string throw typed `AdapterError` in both. Oracle now renders `REGEXP_LIKE` with `:n` placeholders instead of inherited PostgreSQL syntax.
- TypeORM filters append with `andWhere` under per-run namespaced parameter names (`:rapiq_<n>_<i>`), preserving caller-owned predicates *and* caller-owned parameter bindings (TypeORM parameters are builder-global, so positional `:0` names would rebind). Sort and pagination follow the same contract: a query without sorts/pagination leaves a caller-owned `ORDER BY`/`take`/`skip` untouched. The default relation alias is the injective length-prefixed `buildRelationAlias` (`realm` → `r5_realm`, `role.realm` → `r4_role_5_realm`), bounded to 63 chars with a hash suffix so PostgreSQL identifier truncation cannot collapse long distinct paths.

## Public-API triage (plan 008, items 1+2)

`@rapiq/core`'s export surface is now intentional. **Removed public exports**:

- Utils that were only ever internal plumbing: `applyMapping`, `isPathAllowed`, `isPropertyNameValid`, `hasOwnProperty`, `KEY_REGEX` (use `ResolutionScope` instead for key/alias/allow-list resolution).
- Dead code: `merge` (use `smob` directly), `escapeRegExp`, `LinkedList`/`LinkedListNode`, `diffArray`, `buildKeyPath`, `toKeyPathArray`, `renameObjectKeys`, `reduceObject`, `extendObject`, `toFlatObject`, `groupArrayByKeyPath` (now a protected `BaseParser` helper).
- `IInterpreter` (`interpreter/`) — no implementation existed; will return with the first real consumer.

**Still public** (documented + tested): `parseKey`, `stringifyKey`, `KeyDetails`, `isObject`, `isPropertySet`. The `smob` runtime dependency was dropped from `@rapiq/core`.

## SQL adapter completion (plan 005)

- `@rapiq/sql`'s deliverable is **clause fragments**, not full statements: `Adapter.execute(query)` returns `SqlFragments` (`{ columns, where, params, orderBy, limit, offset, relations }`); FROM/JOIN assembly stays with the caller, which knows the join conditions. Backend adapters (typeorm) reuse the same `execute(query)` entry point but apply the accumulated state to a query builder (bound at construction via the `queryBuilder` option) instead of returning fragments. (Historically this was `build()` for fragments + a no-arg `execute()` for the apply step, then briefly `execute(query, target)`; the builder moved into the constructor's `queryBuilder` option in the adapter-execute refactor.)
- **Null semantics** (typeorm-extension parity): `eq(field, null)` → `field IS NULL`, `ne(field, null)` → `IS NOT NULL`, `in` with a null element → `(field IN (...) OR field IS NULL)`, `nin` with null → `(field NOT IN (...) AND field IS NOT NULL)`. Previously null was bound as an ordinary parameter (matched nothing). Applies to @rapiq/typeorm too (shared visitor).
- **MSSQL**: `startsWith`/`endsWith`/`contains` (and negations) now work via `LIKE ... ESCAPE '\'` with wildcard escaping (previously threw); the `regex` operator throws a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`) instead of a raw `Error`. `DialectOptions.regexp` became optional.
- **Error taxonomy** (plan 008 item 5): core exports `AdapterError` with `operatorUnsupported`/`featureUnsupported` factories and `ErrorCode.OPERATOR_UNSUPPORTED`/`FEATURE_UNSUPPORTED`; the raw `Error` throws in @rapiq/sql are migrated.
- Relations adapter no longer duplicates parent path entries (`add('a.b'); add('a.c')` previously pushed `{path:'a'}` twice).
- `AdapterOptions` accepts `rootAlias`, forwarded to the fields/filters/sort sub-adapters.

## Strict mode (M2, plan 011)

- New opt-in `strict` option (schema-level, per-parameter sub-schema, and per parse call), mirroring the `throwOnFailure` plumbing: effective policy is `parse-option ?? schema ?? false`, the parse-option override is inherited into relation recursion, schema-level `strict` propagates to sub-schemas that don't set their own.
- Semantics: under strict, a parameter without an explicit allow-list rejects every client key (`keyNotPermitted`/`pathNotPermitted` verdicts; throws with `throwOnFailure`) instead of falling back to the syntactic property-name check. Fields count `allowed` **or** `default` as declaration; sort's allow-list already derives from `default` keys; a filters `default` condition alone does *not* open client filtering (it still applies as default); relations require `allowed`; **pagination is unaffected** (`maxLimit` remains the only gate — typeorm-extension never disables pagination either).
- `parse(input, { strict: true })` without a schema rejects every client-driven parameter (schema-required parsing). In the expression dialect this throws (expressions are precise); in the simple dialect input is dropped.
- Rationale (plan 010 addendum): typeorm-extension disables any parameter whose `allowed`/`default` options are missing, while v2 treats undefined `allowed` as open — a naive migration would silently widen the attack surface. Migration guide callout: enable `strict: true` on schemas when porting typeorm-extension consumers.
- Error taxonomy (from PR #746 review): relation paths rejected by the relations allow-list/context now throw `keyPathNotPermitted` (new `ErrorCode.KEY_PATH_NOT_ALLOWED`) instead of `keyPathInvalid` — permission failures no longer read as syntax failures. `keyPathInvalid` (`KEY_PATH_INVALID`) remains for unresolvable paths.

## Post-review fixes (PR #741 audit)

- **Compound wrapping**: `FiltersBaseAdapter.merge()` now parenthesizes by condition count instead of the `sql[0] !== '('` heuristic. Previously a nested compound whose first condition was itself parenthesized (e.g. the null-rewrite fragments) was merged unwrapped, producing wrong AND/OR precedence; a top-level multi-condition group is now always wrapped too.
- **Anchored regex patterns** (`@rapiq/core`): `createFilterRegexPattern` used `&&` instead of `&` for the CONTAINS check, so `startsWith`/`endsWith` produced *unanchored* patterns on regexp dialects (pg/mysql/oracle) — they behaved like `contains`. Patterns are now anchored (`^foo`, `foo$`), matching the LIKE-fallback semantics on regexp-less dialects. A pattern built without an anchor flag is now unanchored (was: accidental `input$`).
- **Empty `in`/`nin` lists**: `in(field, [])` renders `1 = 0` (matches nothing) and `nin(field, [])` renders `1 = 1` — previously the invalid SQL `field in()`.
- **sqlite preset** no longer inherits mysql's `regexp` callback (stock SQLite has no `REGEXP` function): anchored operators fall back to `LIKE`, the `regex` operator throws a typed `AdapterError`.
- `FiltersVisitor`: `visitFilterNotEndsWith`/`visitFilterNotContains` signatures used wrong operator type parameters (copy-paste); in/nin and the six anchored-operator methods now share `whereIn`/`whereAnchored` helpers.
- **Literal matching for anchored operators** (from PR #742 review): `createFilterRegexPattern` escapes regex metacharacters — the input is a filter value, not a regex. Previously `contains(name, 'a.b')` matched `axb` on regexp dialects (while the LIKE fallback matched literally) and values like `'('` threw a raw `SyntaxError`. The `regex` operator is unaffected and interprets a `RegExp` or string as a real pattern.
- `notStartsWith` on regexp dialects now matches the empty string (`^(?!foo).*`, was `.+`), consistent with `NOT LIKE 'foo%'`.
