# @rapiq/codec-url

Which codec produced a payload is API-contract metadata — but a gateway that forwards queries it did not author cannot always know it out-of-band. `@rapiq/codec-url` makes payloads **self-describing**: encoding through the registry stamps a reserved `codec` parameter, decoding dispatches on it.

```sh
npm install @rapiq/core @rapiq/codec-url-simple @rapiq/codec-url-expression @rapiq/codec-url
```

## Usage

```typescript
import { createURLCodecRegistry } from '@rapiq/codec-url';

const codecs = createURLCodecRegistry(schemaRegistry);

codecs.encode(query);
// codec=url-simple&filter[name]=John

codecs.encode(query, { codec: 'url-expression' });
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

codecs.decode('codec=url-expression&filter=or(...)', { schema: 'user' });
codecs.decode('filter[name]=John'); // no stamp → default codec (simple)
```

When a schema may run asynchronous filter validators, use `await codecs.encodeAsync(...)` and `await codecs.decodeAsync(...)`. Custom codecs may optionally implement `encodeAsync` / `decodeAsync`; the registry falls back to their synchronous methods when those hooks are absent.

`createURLCodecRegistry()` bundles the two built-in dialects with `url-simple` as the default.

## Dispatch rules

- An **unstamped** payload falls back to the registry default — plain clients and hand-written URLs keep working.
- A payload naming an **unregistered** codec throws a typed `CodecError` (`ErrorCode.CODEC_UNRESOLVABLE`) — it is never silently mis-decoded under another dialect.

## Custom codecs & out-of-band negotiation

Custom codecs implement the `URLCodec` shape (`{ name, encoder, decoder }`) and register on a plain `URLCodecRegistry`. Each bundled package also exports its identifier constant (`URL_SIMPLE_CODEC`, `URL_EXPRESSION_CODEC`) for out-of-band negotiation — e.g. a request header instead of the in-band stamp.
