# @rapiq/codec-url

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Moves a `Query` over a URL boundary. New payloads use expression filters and carry an in-band codec identifier; the decoder also accepts legacy JSON:API-style bracket filters so applications can migrate without a flag day.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression @rapiq/codec-url
```

## Usage

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec(schemaRegistry);

codec.encode(query);
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

codec.decode('codec=url-expression&filter=or(...)', { schema: 'user' });
codec.decode('filter[name]=John', { schema: 'user' }); // legacy simple input
```

Encoding uses `url-expression` by default. During the v2 migration, callers can explicitly request the deprecated simple writer:

```typescript
import { URL_SIMPLE_CODEC } from '@rapiq/codec-url';

codec.encode(query, { codec: URL_SIMPLE_CODEC });
// codec=url-simple&filter[name]=John
```

Decoding dispatches on a stamped codec identifier first. For unstamped input, a string `filter` is treated as an expression and a bracket/object `filter` as the legacy simple dialect. Unknown stamped identifiers throw a typed `CodecError`.

Use `encodeAsync()` and `decodeAsync()` when schema filter validators are asynchronous. Advanced callers can register a custom `URLCodecDefinition` on a `URLCodec` instance.

## Documentation

Full guide: [rapiq.tada5hi.net/packages/codec-url](https://rapiq.tada5hi.net/packages/codec-url)

## License

Published under the [MIT License](https://github.com/Tada5hi/rapiq/blob/master/LICENSE).
