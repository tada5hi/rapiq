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
11. `SimpleParser.parse` / `ExpressionParser.parse` without a schema no longer bind the parameter parsers to a manufactured empty schema — schemaless parsing is uniformly unconstrained (dotted keys survive), consistent with `URLDecoder`.

Known pre-existing issue (out of scope here, plan 006): `BaseParser.expandObject` self-references its accumulator for genuinely nested object input (e.g. filters `{ user: { name: 'x' } }`), causing infinite recursion; flat dotted keys are unaffected.

## Public-API triage (plan 008, items 1+2)

`@rapiq/core`'s export surface is now intentional. **Removed public exports**:

- Utils that were only ever internal plumbing: `applyMapping`, `isPathAllowed`, `isPropertyNameValid`, `hasOwnProperty`, `KEY_REGEX` (use `ResolutionScope` instead for key/alias/allow-list resolution).
- Dead code: `merge` (use `smob` directly), `escapeRegExp`, `LinkedList`/`LinkedListNode`, `diffArray`, `buildKeyPath`, `toKeyPathArray`, `renameObjectKeys`, `reduceObject`, `extendObject`, `toFlatObject`, `groupArrayByKeyPath` (now a protected `BaseParser` helper).
- `IInterpreter` (`interpreter/`) — no implementation existed; will return with the first real consumer.

**Still public** (documented + tested): `parseKey`, `stringifyKey`, `KeyDetails`, `isObject`, `isPropertySet`. The `smob` runtime dependency was dropped from `@rapiq/core`.
