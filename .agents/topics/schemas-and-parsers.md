# Schemas and parser contracts

### Schema definition (core)

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const userSchema = defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'email'] },
    relations: { allowed: ['realm', 'items'], mapping: { abc: 'items' } },
    sorts: { allowed: ['id', 'name'], default: { name: 'DESC' } },
    schemaMapping: { items: 'item' },   // relation name -> registered schema name
});

const registry = new SchemaRegistry();
registry.add(userSchema);
```

Field paths are typed via recursive generics (`NestedKeys<T>`, depth-limited) so `allowed`/`default` keys are checked against the record type.

### ResolutionScope (core)

`ResolutionScope` (`packages/core/src/schema/resolver/`) is the single owner of key resolution — schema-input normalization, alias mapping, allow-list verdicts, relation traversal through the registry (`schemaMapping`-aware, works from unregistered `Schema` instances too) and the throw-vs-drop failure policy with per-parameter error-class selection. Parsers build one scope per `parse()` call and consume two questions:

```typescript
const scope = ResolutionScope.for(registry, Parameter.SORTS, options.schema, {
    relations: options.relations,           // parsed relations gate relation segments
    throwOnFailure: options.throwOnFailure, // context override, inherited by child scopes
});
scope.resolveKey('items.title'); // KeyResolution: { ok, name, path, scope } | { ok: false, code, input, segment }
scope.descend('items');          // child ResolutionScope bound to the related schema, or a failure verdict
```

Parameter quirks (fields `execute()`, filter value parsing) stay in the parsers, reached via the `scope.schema` escape hatch. Scopes created without any schema input are *unbound* and impose no traversal constraints (required for schemaless codec round-trips).

### Parsers (dialects of input)

The query parsers extend `BaseQueryParser` from core and compose one sub-parser per parameter:

- **`SimpleParser`** (`packages/parser-simple/src/module.ts`) — plain object input, URL-query-like:
  ```typescript
  parser.parse({
      fields: ['id', 'name'],
      filters: { name: 'John', age: '>=18' },
      pagination: { limit: 10, offset: 0 },
      relations: ['realm', 'items'],
      sorts: { name: 'DESC' },
  }, { schema: 'user' });
  ```
- **`ExpressionParser`** (`packages/parser-expression/src/module.ts`) — function-call filter expressions (values always single-quoted), tokenizer + recursive-descent parser producing the same `Filters`/`Filter` AST:
  ```
  or(and(eq(name, 'John'), gte(age, '18')), in(status, 'active', 'pending'))
  ```
- **`MongoParser`** (`packages/parser-mongo/src/module.ts`) — MongoDB-style filter documents with typed values (`$`-operator objects, `$and`/`$or`/`$nor` compounds, De Morgan `$not`/`$nor` negation, `$elemMatch`; six `$contains`-family operators are rapiq extensions). Only `filters` is mongo-flavored — the other four parameters reuse the simple sub-parsers. Two-class failure model: grammar errors (unknown/misplaced `$`-operators, malformed values) always throw `FiltersParseError`; field-key/allow-list failures follow the schema drop-vs-throw policy:
  ```typescript
  parser.parse({
      filters: { $or: [{ name: 'John' }, { age: { $gte: 18, $lt: 65 } }] },
  }, { schema: 'user' });
  ```
