# Testing with the Memory Adapter

*Chapter 6 of the [recipes storyline](/guide/recipes/): the same contract as [the search endpoint](/guide/recipes/mongo-search) and its predecessors, executed without a database. Next: the cross-cutting [Authorization & Scoping](/guide/recipes/authorization).*

Everything the previous chapters promised (allow-lists, defaults, the pagination envelope) lives in the schema and the parse pipeline, not in the database. [`@rapiq/adapter-memory`](/packages/adapter-memory) compiles a parsed `Query` into plain functions and applies it to arrays, with the same operator semantics the SQL backends render. That makes the whole contract testable in a unit test: decode real wire input through the real codec and registry, run it against fixtures, assert on the result. No engine, no Docker, no mocks.

## Fixtures

Plain objects standing in for the rows the endpoint would load; embedded `realm` objects stand in for the join:

```typescript
// test/fixtures.ts
import type { User } from '../src/entities';

export const users: User[] = [
    { id: 1, name: 'Ada', email: 'ada@example.com', age: 34, realm: { id: 'a', name: 'Alpha' } },
    { id: 2, name: 'Ben', email: 'ben@example.com', age: 17, realm: { id: 'a', name: 'Alpha' } },
    { id: 3, name: 'Cleo', email: 'cleo@example.com', age: 28, realm: { id: 'b', name: 'Beta' } },
];
```

## Contract tests

`applyQuery(query, data)` filters, sorts, paginates and projects in one call and returns `{ data, total, pagination }`; `total` counts the matches *before* pagination, exactly what chapter 3's `meta` block reports. The decode step is the endpoint's own, so these tests pin the contract, not the implementation:

```typescript
// test/users.spec.ts
import { describe, expect, it } from 'vitest';
import { FiltersParseError } from '@rapiq/core';
import { applyQuery } from '@rapiq/adapter-memory';
import { codec } from '../src/codec';
import { users } from './fixtures';

const decode = (input: string) => {
    const query = codec.decode(input, { schema: 'user' });
    if (!query) {
        throw new Error('invalid query input');
    }

    return query;
};

describe('GET /users contract', () => {
    it('applies the schema defaults', () => {
        const { data, total, pagination } = applyQuery(decode(''), users);

        expect(total).toBe(3);
        expect(pagination).toEqual({ limit: 50, offset: 0 });    // maxLimit doubles as the default
        expect(data[0]).toEqual({ id: 3, name: 'Cleo' });        // default fields, sorted -id
    });

    it('filters, sorts and pages', () => {
        const { data, total, pagination } = applyQuery(
            decode("filter=gte(age,'18')&sort=-age&page[limit]=1&page[offset]=1"),
            users,
        );

        expect(total).toBe(2);                                   // matches before pagination
        expect(pagination).toEqual({ limit: 1, offset: 1 });
        expect(data).toEqual([{ id: 3, name: 'Cleo' }]);
    });

    it('narrows an included relation to its fieldset', () => {
        const { data } = applyQuery(decode('include=realm&fields[realm]=name'), users);

        expect(data[0]).toEqual({ id: 3, name: 'Cleo', realm: { name: 'Beta' } });
    });

    it('rejects keys outside the contract', () => {
        // the endpoint's 400 branch: throwOnFailure turns this into a typed throw
        expect(() => decode('filter[secret]=x')).toThrow(FiltersParseError);
    });
});
```

Chapter 5's search endpoint tests the same way; only the parse step differs:

```typescript
import { MongoParser } from '@rapiq/parser-mongo';
import { registry } from '../src/schema';

const parser = new MongoParser(registry);

it('parses a search document against the same contract', () => {
    const query = parser.parse({
        filters: { $or: [{ name: { $contains: 'ad' } }, { age: { $gte: 30 } }] },
    }, { schema: 'user' });

    expect(applyQuery(query, users).data).toEqual([{ id: 1, name: 'Ada' }]);
});
```

## Guarding single records

Filters compile to standalone predicates, so a condition can be asserted against one object; the [authorization chapter](/guide/recipes/authorization) builds its ability guards on exactly this:

```typescript
import { and, eq, gte } from '@rapiq/core';
import { compileFilters, compileQuery } from '@rapiq/adapter-memory';

// an ability, as data: "may edit adult users of realm a"
const canEditAdults = and(eq('realm.id', 'a'), gte('age', 18));

const guard = compileFilters(canEditAdults);
guard(users[0]);    // true
guard(users[1]);    // false: age 17

// whole-query form: would this record be selected by the client's query?
const compiled = compileQuery<User>(decode("filter=gte(age,'18')"));
compiled.matches(users[0]);    // true
compiled.matches(users[1]);    // false
```

`compileFilters` accepts any condition node (a leaf, a compound tree, a schema's `filters.default`), and compiling once amortizes the cost across many records.

## Why this is a faithful double

The memory adapter aims for [**SQL parity**](/packages/adapter-memory#filter-semantics): null and absent values behave like the single SQL `NULL` (positive operators never match them, negated operators are exact complements), string matching is [case-insensitive by default](/guide/filters#case-sensitivity), and dotted paths over arrays use the same-element join-row binding a SQL join produces. A test that passes here asserts the semantics the database query will have, not a mock's opinion of them.

Two caveats keep it honest:

- It is a *semantics* double, not a database. `relations` neither loads nor prunes anything; fixtures must already carry what the endpoint would join (the embedded `realm` above). Per-backend edge cases are listed in the [divergences table](/packages/adapter-memory#divergences).
- Memory evaluates the full operator set, while the Prisma and Drizzle serializers refuse `regex`, `mod` and `size` with a typed error. A test suite for those backends should not rely on operators the production adapter rejects.

## Next steps

- [Authorization & Scoping](/guide/recipes/authorization): the same compiled predicates as permission guards, plus decode-time gating.
- [@rapiq/adapter-memory](/packages/adapter-memory): the full semantics contract (null handling, case rules, `elemMatch` scopes, projection).
