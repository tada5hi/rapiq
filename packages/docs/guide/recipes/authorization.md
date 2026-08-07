# Authorization & Scoping

*Chapter 7 of the [recipes storyline](/guide/recipes/), the cross-cutting layer: gates and scopes that apply to every previous chapter's endpoint. Previous: [Testing with the Memory Adapter](/guide/recipes/testing-memory).*

Four recurring authorization problems, one query language:

1. **Gating the request**: a client may only *ask for* what its actor is permitted to see; including a relation must require the permission to read the related entity.
2. **Scoping a collection**: a user may only ever see records of their own realm, no matter what they ask for.
3. **Scoping a column**: a field is readable, but only on *some* of the rows the actor is otherwise allowed to see.
4. **Guarding a single record**: an ability like *"may edit users where `realm_id = X`"* must be checked against one object in memory, and must agree exactly with what the database query would return.

## Gating: per-actor checks at decode time

Schema allow-lists say what *any* client may request. The [validate hooks](/guide/schemas#validate-hooks-parse-context) say what *this* actor may request: pass the actor as the parse `context`, and let the schema run a permission check per requested relation (or field, or sort key):

```typescript
type Actor = { can: (permission: string) => Promise<boolean> };

const clientPermissionSchema = defineSchema<ClientPermission, Actor>({
    name: 'client-permission',
    relations: {
        allowed: ['client', 'permission'],
        // ?include=client requires the permission to read clients
        validate: (relation, actor) => actor.can(`${relation}_read`),
    },
    schemaMapping: { client: 'client', permission: 'permission' },
});

app.get('/client-permissions', async (req, res) => {
    const query = await codec.decodeAsync(req.query, {
        schema: 'client-permission',
        context: req.actor,
    });
    // includes the actor may not read are gone before the query
    // ever reaches the database.
});
```

Hooks run against the **target schema** of each path segment (`include=client.realm` checks `client` on this schema and `realm` on the client schema), so an include can never widen access past the related schema's own gate. Rejections follow the schema failure policy: dropped by default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) with `throwOnFailure`. An absent context reaches the hook as `undefined`, so a permission hook written like the one above fails closed.

The `relations` hook is not scoped to `include=`. A dotted `filter[client.name]`, `fields[client]` or `sort=client.name` forces the same join, so the hook runs for those too, evaluated once per distinct relation across the query. An actor denied `client` cannot slip the join in through another parameter.

::: warning Authorization happens at the parse/decode boundary
The gate runs while **parsing untrusted input**: `parse()` / `decode()` and the per-parameter `decode*` helpers. It is a property of that boundary, not of the `Query` object itself: a query you assemble server-side with the schema-free [build layer](/guide/building-queries) (`defineQuery`, condition helpers) and hand straight to an adapter is **not** re-checked; the adapter joins what the query names. Feed client input through a parser/codec with a schema and `context`; keep server-authored queries (and schema `default`s) as the trusted baseline. See [Scoping](#scoping-server-conditions) for adding server conditions.
:::

## Scoping: server conditions

After decoding the client's query, wrap its filters with your scope condition via `and()`:

```typescript
import { Query, eq } from '@rapiq/core';

app.get('/users', async (req, res) => {
    const query = codec.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end();
    }

    // whatever the client sent, it now runs inside the actor's realm
    const scoped = new Query({
        ...query,
        filters: query.filters.and(eq('realm_id', req.actor.realmId)),
    });

    new TypeormAdapter({ queryBuilder }).execute(scoped);
    // ...
});
```

Why `and()` and not a merge? Both produce conjunction, but `and()` makes the intent direct:

- A client filter on `realm_id` narrows *within* the scope; it can never widen it.
- A later [`merge()`](/guide/merging-queries#filters-monotonic-conjunction) adds predicates by ordered logical AND. It cannot remove the scope, even if the client sent no filters at all.

Belt and suspenders: also leave `realm_id` out of the schema's `filters.allowed` list, and clients can't even *mention* it.

When the scope belongs to one *filterable* field rather than the whole query ("you may filter on `realm_id`, but only within your realms"), the filters [`validate` hook](/guide/filters#schema-options) can express it in place: return `and(filter, preserve(inArray('realm_id', actor.realmIds)))`. The policy residual stays attached to the leaf that triggered it. `preserve()` is not needed for merge safety because every merge is conjunctive; it is needed only when the relations validator must reject a pruning contradiction.

::: tip Preserve the residual, not the group
`preserve(and(filter, ...))` also protects the client leaf it wraps, which is not wanted. A preserved condition is exempt from relation pruning, so that shape turns "this actor may not traverse `realm`" into a thrown `SchemaError` when the client filters on `realm.name`, instead of dropping that client filter. Preserving only the residual keeps the client leaf prunable and reserves the error for a real contradiction: a residual that itself names a rejected relation. Scoping through a local column (`realm_id`) never traverses a relation, so it never reaches the gate.
:::

## Row-scoped column access

Some columns aren't a yes/no decision. An actor may read `email` on users of its own realm and nothing else, but the users of other realms must still be listed. A `fields` [validate hook](/guide/schemas#condition-verdicts) answering with a **condition** expresses exactly that: the field stays selected, and the condition marks it visible only on the rows that satisfy it.

`validateMany` is the shape to reach for here, because the policy is usually one lookup for the whole request rather than one per field:

```typescript
import { defineSchema, eq } from '@rapiq/core';

const userSchema = defineSchema<User, Actor>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email'],
        // one call per (schema, relation path): compile the policy once
        validateMany: async (names, actor, scope) => {
            const abilities = await actor.abilitiesFor(scope.schema);

            return Object.fromEntries(names.map((name) => {
                const ability = abilities.read(name);
                if (!ability) {
                    return [name, false];               // not readable at all
                }

                return [name, ability.unconditional ||
                    eq('realm_id', actor.realmId)];     // readable, row-scoped
            }));
        },
    },
});
```

Three verdicts, three outcomes: `false` drops the field from the query, `true` selects it plainly, a condition selects it *and* gates its value. Note the third argument: `scope.path` is `''` at the query root and `'items.owner'` for the same schema reached through an include, so one policy lookup can answer differently per position.

::: danger The gate is applied after the fetch
A condition gates the **value of a column, never the row set**: a user whose `email` is hidden is still returned, without that property. `@rapiq/adapter-memory` enforces this while projecting. `@rapiq/adapter-sql` and `@rapiq/adapter-typeorm` **cannot**: a selection must stay a bare `alias.property` for entity hydration, so they project the column for every row and the gate has to run on the result:

```typescript
import { applyFieldConditions } from '@rapiq/adapter-memory';

const query = await codec.decodeAsync(req.query, {
    schema: 'user',
    context: req.actor,
});

new TypeormAdapter({ queryBuilder }).execute(query);
const rows = await queryBuilder.getMany();

// without this line the gated column ships to the client
res.json(applyFieldConditions(query.fields, rows));
```

The serializer adapters are in the same position. `@rapiq/adapter-prisma` and `@rapiq/adapter-drizzle` keep the gated column selected and force-project the columns the gate reads as select-only entries (in drizzle, an operand that addresses a relation hydrates through `with` instead), so the fetched rows carry everything `applyFieldConditions` needs; nothing enforces the gate in the database. `PrismaAdapter.findMany()` even refuses a query carrying field conditions with a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`) rather than shipping rows unredacted: serialize with `execute()`, run the args yourself, then apply the pass above. The drizzle adapter has no runner at all, so the same post-fetch pass applies to whatever `db.query.<table>.findMany(config)` returns.

This is fail-open by construction. If the column must never reach the process at all, reject the field (`return false`) instead of gating it.
:::

## Guarding: the same query, in memory

Authorization rules often live as conditions (think CASL-style abilities). Because rapiq filters compile to plain predicates, the *same* condition tree guards single records in memory and scopes queries in the database:

```typescript
import { and, eq, gte } from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';

// the ability, as data
const canEditAdults = and(
    eq('realm_id', actor.realmId),
    gte('age', 18),
);

// in memory: guard one record
const guard = compileFilters(canEditAdults);
if (!guard(user)) {
    throw new ForbiddenError();
}

// in the database: scope the collection with the identical condition
const scoped = new Query({
    ...query,
    filters: query.filters.and(canEditAdults),
});
```

`@rapiq/adapter-memory` aims for **SQL parity** (null handling, string matching and relation-path binding match what the SQL/TypeORM adapters produce), so the guard and the query cannot drift apart. Semantics details: [@rapiq/adapter-memory](/packages/adapter-memory#filter-semantics).

For whole-query checks (fields, sort, pagination included), compile once and reuse:

```typescript
import { compileQuery } from '@rapiq/adapter-memory';

const compiled = compileQuery<User>(query);
compiled.matches(user);    // would this record be selected?
compiled.apply(users);     // apply the full query to loaded data
```

## Layered defense summary

| Layer | Mechanism | Stops |
|---|---|---|
| Schema allow-list | `filters.allowed` without `realm_id` | clients referencing the scope field at all |
| Validate hooks + context | `relations.validate: (name, actor) => ...` | actors requesting includes/fields they lack permissions for |
| Condition verdict + post-fetch pass | `fields.validateMany` returning a condition | a readable column leaking on rows outside the actor's scope |
| Injected condition | `query.filters.and(...)` | any query escaping the actor's scope |
| Memory guard | `compileFilters(ability)` | single-record actions disagreeing with query semantics |

## Next steps

- [Merging & Composition](/guide/merging-queries): conjunctive query composition and pruning preservation.
- [@rapiq/adapter-memory](/packages/adapter-memory): the full in-memory semantics contract.
