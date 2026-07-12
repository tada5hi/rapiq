# Fields

Select which resource fields are returned — or extend/shrink the server's default selection.

| | |
|---|---|
| URL key | `fields` |
| AST nodes | `Fields` / `Field { name, operator? }` |
| Schema options | `allowed`, `default`, `mapping` |

## On the wire

```txt
fields=id,name,email          one list for the root resource
fields[items]=id,name         per-relation lists
fields=+email                 extend the default selection
fields=-name                  shrink it
```

The equivalent parser input shapes (what [`SimpleParser`](/packages/parser-simple) and the [URL decoder](/guide/wire) accept):

```typescript
{ fields: 'id,name,email' }                    // comma-separated string
{ fields: ['id', 'name'] }                     // array of names
{ fields: { items: ['id', 'name'] } }          // record keyed by relation
{ fields: [['id'], { items: ['id'] }] }        // tuple: base + relations
```

## Include & exclude modifiers

A field name can carry a prefix that changes how it combines with the schema's `default` selection:

| Syntax | Meaning |
|---|---|
| `name` | Select this field (replaces the default selection). |
| `+name` | **Include** — extends the default selection instead of replacing it. |
| `-name` | **Exclude** — removes the field from the selection. |

```typescript
// schema default is ['id', 'name'] —
{ fields: '+email' }   // → id, name, email
{ fields: '-name' }    // → id
```

In the AST, the prefix becomes `Field.operator` (`FieldOperator.INCLUDE` / `FieldOperator.EXCLUDE`).

## Building in code

The same shapes work as typed [build input](/guide/building-queries) — field paths checked against the record type:

```typescript
defineQuery<User>({ fields: ['id', '+email'] });

defineFields<User>(['id', 'name']);   // standalone fragment
```

## Fields of related records

Fields of a relation use the relation name as key (or a `relation.field` path) and validate against the **related** schema, resolved through [`schemaMapping`](/guide/schemas#the-registry--relations). The relation itself must be allowed and requested via [relations](/guide/relations).

```typescript
{
    relations: ['items'],
    fields: { items: ['id', 'name'] },
}
```

## Schema options

```typescript
defineSchema<User>({
    fields: {
        allowed: ['id', 'name', 'email', 'age'],
        default: ['id', 'name'],
        mapping: { displayName: 'name' },
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Selectable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Selection when the client sends nothing (or only `+`/`-` modifiers). |
| `mapping` | Alias → field translation applied before validation. |

## On violation

Disallowed or invalid field input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `FieldsParseError` instead.
