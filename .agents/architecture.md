# Architecture

## Query pipeline and ownership

Rapiq uses the query AST in `@rapiq/core` as its transport-independent intermediate representation.

```text
Client builders -> Query AST -> URL codec -> query string
                                             |
Server schema <- parser <- URL codec decode --+
       |
Validated Query AST -> backend adapter -> SQL / ORM arguments / in-memory result
```

- `defineQuery()` and the condition helpers construct AST nodes directly; they do not parse wire values or enforce server schemas.
- Parsers own dialect syntax, coercion and schema enforcement. They consume canonical parameter names, not raw HTTP names.
- `@rapiq/codec-url` owns query-string parsing, transport names, dialect stamps and HTTP input such as `req.query`.
- Adapters consume the AST. SQL/TypeORM/memory interpret semantic plans; Prisma/Drizzle serialize them into backend arguments.
- Import public contracts from the package that owns them. Cross-package forwarding must not create a second owner for a value.

The AST includes fields, filters, pagination, relations, sorts, groups and aggregates. Keep parameter-specific changes in the matching directory across core, parsers, codecs and adapters. Public exports and declaration paths are compatibility surfaces.

## Condition identity and composition

`ICondition` is the open structural filter contract. Its `CONDITION_MARKER` brand distinguishes a live condition from detached `{ operator, value }` data. Extending `Condition` supplies the marker. Built-in `Filter` and `Filters` support specialized visitor dispatch; custom conditions can define their own consumer contract and stay opaque to built-in flattening/merging.

`mergeQueries()` is immutable: fields, relations and sorts use keyed left priority; pagination uses per-property left priority; filters use ordered logical conjunction so every predicate survives. Build alternatives with `and()`/`or()` condition trees, not OR-composition of complete queries.

`preserve()` is a relation-pruning policy wrapper, independent of merge and identity. To add a policy residual, preserve that residual rather than its entire client-containing group. A preserved condition that itself requires a rejected relation raises `SCHEMA_PRESERVED_CONDITION_PRUNED`.

Built-in adapters consume `planCondition()`. Per-operator extension belongs in the plan interpreter, not ad hoc branches that bypass core semantics. Negation is the null-inclusive complement per binding; SQL's three-valued `NOT` cannot substitute for it. `Filters.flatten()` must not hoist through NOT. See [query AST and visitor contracts](topics/query-ast.md).

## Schema resolution and parsing

`ResolutionScope` in `packages/core/src/schema/resolver/` owns schema normalization, alias mapping, allow-list decisions, relation traversal through `SchemaRegistry`, and failure policy. Parameter parsers use the scope rather than implementing another resolver. Parsed relations gate relation paths; `schemaMapping` selects the related schema. An unbound scope permits schemaless codec round trips.

Schema policies can drop disallowed input or throw. Use strict schemas when an undefined allow-list must deny access; the resolver's default strict policy is false. Keep alias mapping, relation pruning and index policy checks in their shared pipeline so parsers agree about the query that will execute.

Filter validation runs on resolved/coerced leaves and can return a replacement condition. Synchronous methods remain synchronous and reject thenables with `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER`; async methods await validators sequentially in tree order. Defaults apply when validation removes every leaf. Query parsers are constructed with their schema registry, for example `new SimpleParser(registry)`.

See [schemas and parser contracts](topics/schemas-and-parsers.md) for scope usage and dialect examples.

## Codec guarantees

Each dialect supports a subset of the AST. Within it, `decode(encode(query))` preserves semantics modulo untyped wire scalar normalization. Unsupported features/operators throw typed errors rather than silently changing meaning. The simple encoder verifies that its emitted tokens decode to the same operators.

`URLCodec.encode()` stamps the codec name unless `stamp: false` is requested. Decoding uses a nonempty stamp first, then registered `detect()` hooks in order. The bundled default writes expression filters and reads expression or simple bracket input. Unknown stamped names throw `CodecError`.

Schema-aware encoding validates through the schema-bound decoder and re-encodes. Parameters absent from the input are masked so schema defaults do not appear on the wire. Sync/async encode and decode preserve the parser validation contract. Shared simple filter-value grammar belongs in `@rapiq/parser-simple`.

## Backend and error boundaries

Backend adapters must agree on null/missing values, negation, case handling, relation binding and include projection. TypeORM filters use `andWhere()` so application-owned tenant/auth predicates survive. SQL relation aliases come from the shared `buildRelationAlias()` function. Exported base-class protected members are part of the subclassing contract. Read [adapter contracts](topics/adapters.md) before changing lowering or hydration behavior.

`BaseError` extends `@ebec/core`'s base error and adds rapiq's typed code vocabulary and issue trace. Use `isBaseError()`/`isParseError()` brands across duplicate package instances and serialized boundaries. Client-input rejections are issue data, not an `Error` object per rejected key. Unexpected server errors propagate; do not convert them into client parse failures.

A collecting parse raises one `INPUT_REJECTED` error with its issue tree. Standalone parameter failures use their parameter error class; a whole-query failure uses `ParseError`. Live issues retain diagnostic values, while `BaseError.toJSON()` recursively removes `expected` and `received`. Error equality includes enumerable traces, so tests should assert the relevant class, code or issues. See [error and issue contracts](topics/query-errors.md).

The [consumer migration notes](references/migration-notes.md) are an on-demand reference for porting external consumers.
