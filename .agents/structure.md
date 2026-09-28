# Project Structure

npm-workspaces monorepo (`packages/*`) orchestrated by Nx. Every publishable package follows the same layout: `src/` (source), `test/` (vitest config + specs), `dist/` (build output, gitignored).

## Packages & Libraries

| Name                                                      | Type     | Description                                                                 |
|-----------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| [@rapiq/core](../packages/core)                           | Library  | Query AST (fields/filters/pagination/relations/sorts/groups/aggregates), visitor interfaces, schema system + registry, parser base classes, errors |
| [@rapiq/parser-simple](../packages/parser-simple)         | Library  | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](../packages/parser-expression) | Library  | Parses a function-call expression language (e.g. `and(eq(name, 'John'), gte(age, '18'))`) into a `Query` |
| [@rapiq/parser-mongo](../packages/parser-mongo)           | Library  | Parses MongoDB-style filter documents (e.g. `{ age: { $gte: 18 } }`, `$and`/`$or`/`$not`) into a `Query` |
| [@rapiq/codec-url](../packages/codec-url)                 | Library  | URL transport façade: expression-default encoding, expression + legacy simple decoding, in-band dialect dispatch; uses `qs` |
| [@rapiq/adapter-sql](../packages/adapter-sql)                             | Library  | Dialect-agnostic SQL adapter + visitor; ships dialect presets (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/adapter-typeorm](../packages/adapter-typeorm)                     | Library  | Adapter applying a parsed `Query` to a TypeORM `SelectQueryBuilder`         |
| [@rapiq/adapter-prisma](../packages/adapter-prisma)                       | Library  | Adapter serializing a parsed `Query` into a Prisma `findMany` args object (pure value, no prisma dependency) |
| [@rapiq/adapter-drizzle](../packages/adapter-drizzle)                     | Library  | Adapter serializing a parsed `Query` into a drizzle relational-queries v2 `findMany` config (pure value, no drizzle dependency) |
| [@rapiq/adapter-memory](../packages/adapter-memory)                       | Library  | Evaluates a parsed `Query` against in-memory objects/arrays: visitors compile the AST into plain functions (predicate/comparator/projector/slicer) |
| [@rapiq/cache](../packages/cache)                         | Library  | Tag-invalidated result cache: `TaggedCache` over an `ICacheDriver` (tag versions on one logical clock), `MemoryCacheDriver`, query tag derivation (`collectQueryTags`, `isCacheable`, `rememberQuery`), the TypeORM write side (`CacheInvalidationSubscriber`, behind the `@rapiq/cache/typeorm` subpath; `typeorm` as an optional type-only peer), the shared driver contract suite |
| [@rapiq/cache-redis](../packages/cache-redis)             | Library  | Redis `ICacheDriver` for `@rapiq/cache` over `ioredis`: `RedisCacheDriver`, the write/read/invalidate steps as three Lua scripts registered through `defineCommand`; an entry is a hash (`clock`, `tags`, `value` as JSON) so the read script decodes the tag list and never the value; keys `<prefix>:e:`, `<prefix>:t:`, `<prefix>:c`; the spec suite is `describe.runIf`-gated on a live Redis at `REDIS_URL` (db 15) and runs its files sequentially, since they share that database |
| [@rapiq/docs](../packages/docs)                           | Docs app | VitePress documentation site (rapiq.tada5hi.net); private, not published    |

## Package Dependency Layers

Internal dependencies are declared as `peerDependencies` in each package's `package.json` — consult those for the authoritative graph. Nx builds in this order (`build` dependsOn `^build`):

```
Foundation (no internal deps):
  @rapiq/core

Layer 1 (depend on core):
  @rapiq/parser-simple
  @rapiq/adapter-sql
  @rapiq/adapter-memory
  @rapiq/adapter-prisma
  @rapiq/adapter-drizzle
  @rapiq/cache               (core; @ebec/core for the error brand; typeorm as an optional type-only peer)

Layer 2:
  @rapiq/parser-expression   (core + parser-simple)
  @rapiq/parser-mongo        (core + parser-simple)
  @rapiq/adapter-typeorm             (core + sql + typeorm)

Layer 3:
  @rapiq/codec-url           (core + parser-simple + parser-expression)

Layer 2, outside the query pipeline:
  @rapiq/cache-redis         (cache + ioredis peer)
```

Changes to `@rapiq/core` affect every other package.

## Per-Package Source Layout

`@rapiq/core` — the foundation everything else builds on:

```
packages/core/src/
├── parameter/            # Query AST node classes + visitor interfaces
│   ├── aggregates/       # Aggregates/Aggregate (count/sum measures of a grouped read)
│   ├── call/             # CallTerm/CallLowering, GroupFunction/AggregateFunction/BucketUnit + slot tables, isCallEqual, resolveGroupedSorts, assertGroupedQuery, findGroupColumnDuplicate
│   ├── fields/           # Fields/Field (include/exclude operators)
│   ├── filters/          # Filters (compound and/or) + Filter (field-op-value condition); CONDITION_MARKER/Condition identity and preserve() pruning wrapper
│   │   └── helpers/      # typed condition helpers (eq, gte, inArray, and, or, …)
│   ├── groups/           # Groups/Group (grouped-read dimensions: bare column or bucket call)
│   ├── pagination/       # Pagination (limit/offset)
│   ├── relations/        # Relations/Relation
│   ├── sorts/            # Sorts/Sort (asc/desc)
│   ├── merge.ts          # mergeQueries: keyed left priority for fields/relations/sorts, per-property pagination, monotonic filter conjunction, groups/aggregates refuse a conflict
│   └── module.ts         # Query, IQueryVisitor (queries are built via defineQuery or parsed)
├── build/                # typed build layer: defineQuery + per-parameter define* factories
│   └── parameter/        # Build*Input types + defineFields/defineFilters/… (schema-free, direct-to-AST)
├── schema/               # Schema, defineSchema(), per-parameter sub-schemas
│   ├── parameter/        # FieldsSchema, FiltersSchema, ... + define* factories; call/ normalizes groups/aggregates function declarations (resolveCallTerm)
│   ├── registry/         # SchemaRegistry (named schemas, cross-schema resolution)
│   └── resolver/         # ResolutionScope (key/alias/allow-list/relation-path resolution)
├── parser/               # BaseParser + per-parameter parse-option types & error classes
├── errors/               # BaseError + ParseError/FiltersParseError/BuildError/MergeError + error codes
└── utils/                # key path parsing (public), mapping/allow-list helpers (internal)
```

Parser packages mirror core's parameter split:

```
packages/parser-{simple,expression,mongo}/src/
├── parameter/{fields,filters,pagination,relations,sorts}/   # one parser class per parameter
├── parameter/{call,groups,aggregates}/   # parser-simple only: call-term grammar + SimpleGroupsParser/SimpleAggregatesParser, reused by the other two dialects
└── module.ts             # SimpleParser / ExpressionParser / MongoParser composing them
```

Backend/codec packages:

```
packages/adapter-sql/src/
├── adapter/              # Adapter + per-parameter sub-adapters (accumulate SQL fragments); grouped/ builds executeGrouped clauses + row normalization
├── dialect/              # pg, mysql, sqlite, mssql, oracle DialectOptions presets; bucket.ts holds the mysql/sqlite bucket formats
├── visitor/              # QueryVisitor walking the AST into the adapter
└── helpers/

packages/adapter-typeorm/src/
└── adapter/              # TypeormAdapter + sub-adapters targeting SelectQueryBuilder

packages/adapter-prisma/src/
├── adapter/              # PrismaAdapter + per-parameter sub-adapters building the args object
├── metadata/             # IMetadata + Metadata/defineMetadata over a prisma datamodel (DMMF-shaped)
└── provider/             # per-connector capability presets (mode: 'insensitive' support)

packages/adapter-drizzle/src/
├── adapter/              # DrizzleAdapter + pure renderers (where/fields/sort/merge) for the RQBv2 findMany config
├── metadata/             # IMetadata + defineMetadata over a hand-written drizzle-vocabulary datamodel
└── provider/             # per-dialect capability presets (ilike availability, LIKE escape)

packages/adapter-memory/src/
├── parameter/{fields,filters,pagination,relations,sorts}/  # visitors compiling AST nodes into functions
├── query/                # CompiledQuery (matches/apply, pagination echo)
├── grouped/              # compileGroupedQuery/applyGroupedQuery (group, aggregate, UTC bucket truncation): the grouped parity oracle
├── helpers/              # value semantics (normalize/equal/compare/resolve)
└── module.ts             # QueryVisitor + compileQuery/applyQuery/compile* helpers

packages/cache/src/
├── tag.ts                # the tag vocabulary: buildCollectionTag / buildRecordTag / buildScopedTag (shared by readers and writers)
├── driver/               # ICacheDriver + CacheEntry contract, MemoryCacheDriver (Maps + clock, lazy expiry, bounded prune)
├── errors/               # CacheError (extends core BaseError, own instanceof brand) + isCacheError
├── query/                # isCacheable (no Field.condition), collectQueryTags (root scope, relation collections, record tags), rememberQuery
├── typeorm/              # CacheInvalidationSubscriber (subpath `@rapiq/cache/typeorm`): row tags per insert/update/remove/soft remove/recover, cascade children, bump at the outermost commit (typeorm types only)
└── module.ts             # TaggedCache: remember (clock before read, fall through on driver failure), invalidate, drop

packages/cache-redis/src/
├── constants.ts          # default prefix, key segments (e/t/c), entry hash fields, the defineCommand names
├── scripts.ts            # the three Lua sources (write: KEYS entry+clock+tags; read: KEYS entry+clock, tag keys from ARGV prefix; invalidate: KEYS clock+tags)
├── module.ts             # RedisCacheDriver: defineCommand once per client, JSON values, ttl clamped to maxTtl, drop = DEL
└── types.ts              # RedisCacheClient (Redis | Cluster), RedisCacheDriverOptions, the script-augmented client type

packages/codec-url/src/
├── module.ts             # public URLCodec façade + custom dialect registration (detect hooks)
├── factory.ts            # createURLCodec (bundles both; expression default; structural detects)
├── constants.ts          # URLParameter wire names + reserved CODEC_PARAMETER
├── decoder/              # shared BaseURLDecoder (qs parse + wire-name mapping pipeline)
├── utils/                # shared encode helpers (parameter mask, schema-awareness)
├── expression/           # internal expression encoder/decoder strategy
└── simple/               # internal legacy encoder/decoder + shared URL serializers
```

## Package Exports

All packages share the same export shape — single entry point, ESM-only build:

```json
{
    "type": "module",
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.mts",
            "import": "./dist/index.mjs"
        }
    }
}
```

Public API is controlled via the barrel `src/index.ts` of each package; anything not re-exported there is internal.

The one deviation is `@rapiq/cache`, which adds a second entry, `@rapiq/cache/typeorm` (`src/typeorm/index.ts` -> `dist/typeorm.mjs` + `dist/typeorm.d.mts`), so the types of its optional `typeorm` peer never leak into the root `index.d.mts`.

## Separation of Concerns

- **AST & type definitions** → `@rapiq/core` (`parameter/`)
- **What a client may request (allow-lists, defaults, mappings)** → `@rapiq/core` (`schema/`)
- **Turning raw URL input into the AST** → `@rapiq/codec-url` (dispatch + decode through parser-simple/parser-expression)
- **Turning the AST into URL transport format** → `@rapiq/codec-url` (expression-default encode; deprecated explicit simple encode)
- **Turning the AST into backend queries** → `@rapiq/adapter-sql`, `@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle`
- **Evaluating the AST against in-memory data** → `@rapiq/adapter-memory` (predicates/comparators/projectors compiled from the AST)
- **Caching a result and knowing when it went stale** → `@rapiq/cache` (tags derived from the AST + schema, versioned by a driver), `@rapiq/cache-redis` (the shared-store driver)
