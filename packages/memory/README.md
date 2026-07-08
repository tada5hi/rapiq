# @rapiq/memory

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

This package evaluates a parsed `Query` against **in-memory data** — plain JavaScript
objects and arrays. It is the in-memory sibling of `@rapiq/sql` and `@rapiq/typeorm`:
the same visitor-pattern adapter surface, but instead of SQL fragments or a query
builder, the visitors compile the query AST into plain functions (predicate,
comparator, projector, slicer).

```typescript
import { and, eq, gte } from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';

const matches = compileFilters(and(eq('name', 'Peter'), gte('age', 18)));

matches({ name: 'Peter', age: 28 }); // true
matches({ name: 'Peter', age: 16 }); // false
```

## Installation

```sh
npm install @rapiq/core @rapiq/memory
```

## Usage

Apply a whole query to a collection:

```typescript
import { defineQuery } from '@rapiq/core';
import { applyQuery } from '@rapiq/memory';

const query = defineQuery<User>({
    filters: { age: { $gte: 18 } },
    sort: { name: 'ASC' },
    pagination: { limit: 10 },
    fields: ['id', 'name'],
});

const { data, total, pagination } = applyQuery(query, users);
```

Or compile individual parameters:

```typescript
import {
    compileFields,
    compileFilters,
    compilePagination,
    compileSorts,
} from '@rapiq/memory';

const predicate = compileFilters(query.filters);   // (input) => boolean
const comparator = compileSorts(query.sorts);      // (a, b) => number
const projector = compileFields(query.fields);     // (input) => projected
const slicer = compilePagination(query.pagination); // (data) => data page
```

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/integrations/memory).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).
