# @rapiq/codec-url-expression

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

URL codec for the [expression dialect](https://rapiq.tada5hi.net/integrations/expression): the filters parameter crosses the URL boundary as a single expression — nested `and`/`or` compounds first-class — while the other four parameters share the [simple codec](https://www.npmjs.com/package/@rapiq/codec-url-simple)'s wire format.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-expression @rapiq/codec-url-simple @rapiq/codec-url-expression
```

## Usage

```typescript
import { URLDecoder, URLEncoder } from '@rapiq/codec-url-expression';
import { and, defineQuery, eq, gte, or } from '@rapiq/core';

const encoder = new URLEncoder();

const query = defineQuery({
    filters: and(eq('name', 'John'), or(gte('age', 18), eq('email', null))),
    pagination: { limit: 20 },
});

encoder.encode(query);
// filter=and(eq(name,'John'),or(gte(age,'18'),eq(email,null)))&page[limit]=20
```

`URLDecoder` reverses it, delegating filters to the [`ExpressionParser`](https://www.npmjs.com/package/@rapiq/parser-expression) — pass a `SchemaRegistry` and `{ schema }` to validate untrusted input.

The expressible subset is wider than the simple dialect's: nested compounds, several conditions on the same field and comma-containing strings all round-trip. Still outside it — and loudly rejected on encode with typed errors — are the `regex`/`mod`/`exists`/`elemMatch` operators, match text coercing to a non-string, and field segments colliding with grammar keywords.

The package exports its codec identifier (`URL_EXPRESSION_CODEC`) for out-of-band negotiation; for in-band dispatch between dialects see [@rapiq/codec-url](https://www.npmjs.com/package/@rapiq/codec-url).

## Documentation

Full guide: [rapiq.tada5hi.net/integrations/url#expression-dialect](https://rapiq.tada5hi.net/integrations/url#expression-dialect)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).
