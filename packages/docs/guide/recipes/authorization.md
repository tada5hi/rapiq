# Authorization & Scoping

Three recurring authorization problems, one query language:

1. **Gating the request** — a client may only *ask for* what its actor is permitted to see: including a relation must require the permission to read the related entity.
2. **Scoping a collection** — a user may only ever see records of their own realm, no matter what they ask for.
3. **Guarding a single record** — an ability like *"may edit users where `realm_id = X`"* must be checked against one object in memory, and must agree exactly with what the database query would return.

## Gating: per-actor checks at decode time

Schema allow-lists say what *any* client may request. The [validate hooks](/guide/schemas#validate-hooks--parse-context) say what *this* actor may request: pass the actor as the parse `context`, and let the schema run a permission check per requested relation (or field, or sort key):

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

Hooks run against the **target schema** of each path segment — `include=client.realm` checks `client` on this schema and `realm` on the client schema — so an include can never widen access past the related schema's own gate. Rejections follow the schema failure policy: dropped by default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) with `throwOnFailure`. An absent context reaches the hook as `undefined`, so a permission hook written like the one above fails closed.

## Scoping: inject conditions the client can't displace

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

Why `and()` and not a merge? `and()` **wraps** the client's tree as a sibling of the injected condition — the condition becomes structure, not data:

- A client filter on `realm_id` narrows *within* the scope; it can never widen it.
- The wrapped tree is no longer flat, so a later [`merge()`](/guide/merging-queries#merge--per-field-replace) throws `MergeError` instead of silently displacing the scope condition. The failure mode defends the invariant.

Belt and suspenders: also leave `realm_id` out of the schema's `filters.allowed` list, and clients can't even *mention* it.

## Guarding: the same query, in memory

Authorization rules often live as conditions (think CASL-style abilities). Because rapiq filters compile to plain predicates, the *same* condition tree guards single records in memory and scopes queries in the database:

```typescript
import { and, eq, gte } from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';

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

`@rapiq/memory` aims for **SQL parity** — null handling, string matching and relation-path binding match what the SQL/TypeORM adapters produce — so the guard and the query cannot drift apart. Semantics details: [@rapiq/memory](/packages/memory#filter-semantics).

For whole-query checks (fields, sort, pagination included), compile once and reuse:

```typescript
import { compileQuery } from '@rapiq/memory';

const compiled = compileQuery<User>(query);
compiled.matches(user);    // would this record be selected?
compiled.apply(users);     // apply the full query to loaded data
```

## Layered defense summary

| Layer | Mechanism | Stops |
|---|---|---|
| Schema allow-list | `filters.allowed` without `realm_id` | clients referencing the scope field at all |
| Validate hooks + context | `relations.validate: (name, actor) => ...` | actors requesting includes/fields they lack permissions for |
| Injected condition | `query.filters.and(...)` | any query escaping the actor's scope |
| Memory guard | `compileFilters(ability)` | single-record actions disagreeing with query semantics |

## Next steps

- [Merging & Composition](/guide/merging-queries) — why injected trees resist merging.
- [@rapiq/memory](/packages/memory) — the full in-memory semantics contract.
