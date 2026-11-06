# Architecture

## Query pipeline

Rapiq uses a typed query AST as its intermediate representation. Client helpers construct that AST. Parsers turn dialect-specific input into the AST and validate it against server-owned schemas. Backend adapters consume it through visitors, serializers, or in-memory evaluation. URL codecs own the HTTP wire format.

`@rapiq/core` owns transport-independent query and schema contracts. Parsers and adapters do not depend on HTTP names or raw `req.query` objects. A value belongs to one package; consumers import it from its owner rather than forwarding it through another package.

## Schemas and extension contracts

Schemas declare allowed/default values, mappings, relation schemas, and validation hooks. Disallowed input is dropped or throws according to the schema policy. Relation traversal resolves through `SchemaRegistry`. Strict schemas are required when undefined allow-lists must deny access.

`ICondition` is the structural filter extension contract and carries `CONDITION_MARKER`. Built-in conditions support specialized visitors; custom conditions remain opaque to flattening and merging unless the consumer understands them. `preserve()` keeps a policy subtree atomic during relation pruning.

## Composition and codecs

Query composition is immutable. Fields, relations, and sorts use keyed left priority; pagination uses per-property left priority; filters use ordered logical conjunction so every predicate survives. Complete queries are never OR-composed.

Each codec supports a subset of the IR. Within that subset, decoding encoded input preserves semantics modulo wire scalar normalization. Unsupported input throws a typed error rather than silently changing meaning. Codec identity travels in the payload; registered detection handles unstamped input. Schema-aware encoding validates through the schema-bound decoder.

Synchronous parser/codec methods stay synchronous and reject asynchronous validation results. Async methods await validators sequentially in tree order. Diagnostic data stays live in memory and is redacted by error serialization.

## Detailed references

Read [the architecture reference](references/architecture.md) for adapter and dialect contracts, and [the migration ledger](references/migration-notes.md) when porting existing consumers. These references are loaded on demand.
