# @rapiq/codec-url

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Makes URL payloads self-describing across codec dialects: encoding through the `URLCodecRegistry` stamps a reserved `codec` parameter, decoding dispatches on it. Useful wherever the receiving side cannot know out-of-band which dialect produced a payload — a gateway forwarding queries it did not author, for instance.

## Installation

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

Dispatch rules:

- An **unstamped** payload falls back to the registry default — plain callers and hand-written URLs keep working.
- A payload naming an **unregistered** codec throws a typed `CodecError` (`ErrorCode.CODEC_UNRESOLVABLE`) — it is never silently mis-decoded under another dialect.

`createURLCodecRegistry()` bundles the [simple](https://www.npmjs.com/package/@rapiq/codec-url-simple) and [expression](https://www.npmjs.com/package/@rapiq/codec-url-expression) dialects with `url-simple` as the default. Custom codecs implement the `URLCodec` shape (`{ name, encoder, decoder }`) and register on a plain `URLCodecRegistry`.

## Documentation

Full guide: [rapiq.tada5hi.net/packages/codec-url](https://rapiq.tada5hi.net/packages/codec-url)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).
