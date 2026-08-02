# Drizzle ORM

Target of `@rapiq/adapter-drizzle` (plan 026). The adapter serializes the rapiq IR into a
relational-queries v2 (RQBv2) `findMany` config object. RQBv2 ships with drizzle-orm v1
(`1.0.0-rc.x`; npm `latest` is still the 0.45 line with the callback-based RQBv1).

## Version landscape (checked 2026-08-02)

| dist-tag | version | relational API |
|---|---|---|
| `latest` | 0.45.2 | RQBv1: `where: (table, { eq }) => ...` callback, table-bound operator functions |
| `rc` | 1.0.0-rc.4 (2026-06-27) | RQBv2: object-based `where`, `defineRelations` |
| `beta` | 1.0.0-beta.22 | superseded by the rc line |

## RQBv2 findMany config (the adapter's output shape)

```typescript
db.query.users.findMany({
    where: { /* filter object, see below */ },
    columns: { id: true, name: true },        // or exclusion: { secret: false }
    with: { posts: { columns: {...}, where: {...}, limit, offset } },
    orderBy: { id: 'asc' },                    // or array form for multi-key ordering
    limit: 10,
    offset: 0,
});
```

## Where filter vocabulary

Root level and column level both accept `AND` / `OR` / `NOT`; root level additionally
accepts `RAW: (table) => sql`.

Column operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `like`, `ilike`,
`notLike`, `notIlike`, `isNull`, `isNotNull`, `arrayContains`, `arrayContained`,
`arrayOverlaps`.

```typescript
where: {
    age: { gte: 18 },
    name: { ilike: 'jane%' },
    OR: [{ status: 'active' }, { status: 'pending' }],
    NOT: { role: 'admin' },
    posts: { content: { like: 'M%' } },   // relation filter: ANY related record matches
    comments: true,                        // relation existence test
}
```

Relation filters are existential only (no some/every/none vocabulary as in prisma):
a nested relation object matches records with at least one related record satisfying the
interior; `NOT` around it yields the none form. All conditions inside one relation-filter
object share a single scope (same related record), which is the same-element binding
rapiq's contract requires.

Corresponding code in this project:

| drizzle concept | rapiq counterpart |
|---|---|
| column operators | `packages/adapter-drizzle/src/adapter/where.ts` leaf table (planned) |
| relation filter object | one existential scope from the same-element factoring pass (mirrors `packages/adapter-prisma/src/adapter/where.ts`) |
| `NOT: { rel: true }` | relation absence arm (prisma analogue: `NOT: { rel: { is: {} } }` / `none: {}`) |
| `isNull` / `isNotNull` | null arms of `@rapiq/core` `distributeNegation` complements |
| `columns` | fields pick set (`FieldOperator.INCLUDE`/`EXCLUDE`) |
| `with` | relations + per-relation fieldset narrowing (issue #847) |

## Behavioral notes / differences vs rapiq semantics

- `ne`, `notLike`, `notIlike`, `notIn` render plain SQL and therefore exclude NULL rows;
  rapiq's negations are exact null-inclusive complements, so complements need an
  `isNull` OR-arm (nullability-gated), exactly like `@rapiq/adapter-prisma`.
- `ilike` renders the pg `ILIKE` keyword: only valid on postgres. mysql compares
  case-insensitively via its default `*_ci` collations with plain `like`; sqlite `LIKE`
  is ASCII-case-insensitive. Mirrors the provider-preset reasoning of adapter-prisma and
  the `caseFold` identity of adapter-sql presets.
- LIKE pattern operands are built by the adapter, so `%`/`_`/`\` can be escaped by us
  (default escape character on pg and mysql is backslash). Prisma could not do this
  (operand passed verbatim), hence its wildcard veto; drizzle does not need the veto.
- `orderBy` on a related table's column is not documented for the root query; RQBv1 did
  not support it either.
- No regex, mod or array-length operator (RAW is the only escape hatch).
- `defineRelations(schema, (r) => ({...}))` replaces the v1 `relations()` helpers;
  `from`/`to` replace `fields`/`references`; `through` covers many-to-many.

Sources: https://rqbv2.drizzle-orm-fe.pages.dev/docs/rqb-v2 and
https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v1-v2 (rc docs site).
