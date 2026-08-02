# Relations

Load related resources alongside the primary one, and unlock their fields for [selection](/guide/fields), [filtering](/guide/filters) and [sorting](/guide/sort).

| | |
|---|---|
| URL key | `include` |
| AST nodes | `Relations` / `Relation { name }` |
| Schema options | `allowed`, `mapping`, `validate` / `validateMany` |

## On the wire

```txt
include=realm,items           comma-separated
include=items.realm           nested path (dot notation)
```

Parser input shapes:

```typescript
{ relations: 'realm,items' }        // comma-separated string
{ relations: ['realm', 'items'] }   // array
{ relations: ['items.realm'] }      // nested paths
```

Nested paths automatically include their parents: requesting `items.realm` also includes `items`.

## Building in code

```typescript
defineQuery<User>({ relations: ['items.realm'] });

// record form works too
defineQuery<User>({ relations: { realm: true, items: { user: true } } });

defineRelations<User>(['realm']);   // standalone fragment
```

## Validation

Each requested relation is checked against the schema's `allowed` list. Nested paths resolve segment by segment through [`schemaMapping`](/guide/schemas#the-registry-relations): for `items.realm`, the `items` segment must be allowed on the root schema and `realm` on the schema registered for `items`.

Relation names must match `[a-zA-Z0-9_-]` segments separated by dots; anything else is dropped (or throws with `throwOnFailure`).

## Schema options

```typescript
defineSchema<User>({
    relations: {
        allowed: ['realm', 'items'],
        mapping: { children: 'items' },
    },
    schemaMapping: {
        items: 'item',
        realm: 'realm',
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Traversable relation names. Omit to allow all; `[]` blocks the parameter. |
| `mapping` | Alias → relation translation applied before validation. |
| `validate` / `validateMany` | Per-request [key hooks](/guide/schemas#validate-hooks-parse-context): may this actor traverse this relation? See below. |

## Validate hooks

Allow-lists are static; `validate` / `validateMany` decide **per request**. Every parse/decode call may carry a context (typically the authenticated actor), and the hook answers for each requested relation with that context in hand. The general contract (verdicts, the scope argument, batching, sync/async) lives at [Validate hooks and parse context](/guide/schemas#validate-hooks-parse-context).

```typescript
type Actor = { permissions: string[] };

defineSchema<User, Actor>({
    name: 'user',
    relations: {
        allowed: ['realm', 'items'],
        // may THIS actor include THIS relation?
        validate: (relation, actor) => actor.permissions.includes(`${relation}_read`),
    },
    schemaMapping: { items: 'item' },
});

const query = parser.parse(input, { schema: 'user', context: actor });
```

The hook runs on the canonical (alias-mapped) relation name against the schema that governs it: `include=items.realm` invokes the *user* schema's hook with `items` and the *item* schema's hook with `realm`. A relation is not a column, so an `ICondition` verdict has nothing to gate and counts as a rejection.

Two rules make the gate hard to bypass:

- **Traversal counts.** The hook also gates relations reached through dotted [filter](/guide/filters), [field](/guide/fields) and [sort](/guide/sort) keys (`filter[items.id]`, `fields[items]`, `sort=items.name`), which the backends would otherwise auto-join. It runs **once per distinct relation** across the whole query, so a join has a single authorization point regardless of which parameter forced it.
- **Rejection prunes deep.** Rejecting a relation drops every deeper relation reached through it and every dependent key in every parameter, at parse time; the pruned branch never enters the AST. Under [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) the rejection throws a `RelationsParseError` (`ErrorCode.KEY_VALIDATE_REJECTED`) instead.

## Interaction with other parameters

Parsed relations feed back into the other parameter parsers: fields, filters and sort input that addresses a relation (`items.id`, `realm.name`) is only accepted when the relation was requested and allowed. Request the relation first, then reference its fields. A [validate hook](#validate-hooks) participates in the same wiring: it also authorizes the relations those keys traverse.

## On violation

Disallowed or invalid relation input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `RelationsParseError` instead.
