# @rapiq/parser-mongo

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Parses MongoDB-style filter objects — `$and`/`$or`/`$nor` compounds, field operators like `$eq`, `$gte`, `$in`, `$not`, `$regex` and `$elemMatch` — into the rapiq `Query` AST. Useful when clients submit filters as JSON documents (request bodies, saved queries):

```typescript
{
    $or: [
        { name: 'John', age: { $gte: 18, $lt: 65 } },
        { 'realm.name': { $startsWith: 'mas' } },
    ],
}
```

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-mongo
```

## Usage

```typescript
import { MongoParser } from '@rapiq/parser-mongo';

const parser = new MongoParser(registry);

const query = parser.parse({
    filters: { age: { $gte: 18 }, 'realm.name': 'master' },
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the mongo dialect — fields, relations, pagination and sort accept the same input as [@rapiq/parser-simple](https://www.npmjs.com/package/@rapiq/parser-simple), and the whole thing returns the same [`Query`](https://rapiq.tada5hi.net/guide/query-ast) AST.

Grammar errors (unknown `$`-operators, misplaced operators, malformed operator arguments) always throw `FiltersParseError`; field keys that fail the schema allow-list are dropped by default and throw when `throwOnFailure` is set.

## Documentation

Full guide (operator table & deviations from MongoDB): [rapiq.tada5hi.net/packages/parser-mongo](https://rapiq.tada5hi.net/packages/parser-mongo)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).
