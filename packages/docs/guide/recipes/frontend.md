# Type-Safe Frontend Queries

*Chapter 2 of the [recipes storyline](/guide/recipes/): the client layer of the realm/user API, where queries are built, composed and encoded. Next: the server baseline in [REST API with Express & TypeORM](/guide/recipes/express-typeorm).*

A list component typically owes its query to three sources at once: **defaults** it ships with, a **scope** its parent imposes via props, and **user input** from search/sort/pagination controls. This recipe composes the three declaratively: typed against the record, merged with explicit parameter rules, encoded on demand.

Works the same in Vue, React or plain TypeScript; rapiq has no framework dependency.

## Shared types

Share the record types (and nothing else) between frontend and backend, via a types-only package or a generated client:

```typescript
export type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: { id: string, name: string },
};
```

## The three layers

```typescript
import {
    defineFilters, defineQuery, mergeQueries,
} from '@rapiq/core';
import { createURLCodec } from '@rapiq/codec-url';
import type { User } from 'my-api-types';

const codec = createURLCodec();

// 1. component defaults: shipped with the list
const defaults = defineQuery<User>({
    fields: ['id', 'name', 'email'],
    sort: '-id',
    pagination: { limit: 25 },
});

const defaultFilters = defineFilters<User>({ age: { $gte: 18 } });

// 2. parent-imposed scope: realmId arrives as a prop / argument
//    (fragments are plain values, so they travel well as data)
function scopeFor(realmId: string) {
    return defineFilters<User>({ 'realm.id': realmId });
}

// 3. user input: from the search box & pager
function buildQuery(realmId: string, search: string, page: number) {
    const currentFilters = search ?
        defineFilters<User>({ name: { $contains: search } }) :
        undefined;
    const filters = currentFilters ?? defaultFilters;

    const userInput = defineQuery<User>({
        filters,
        pagination: { offset: (page - 1) * 25 },
    });

    // keyed parameters use left priority; filters become an ordered AND
    return mergeQueries(userInput, defineQuery<User>({ filters: scopeFor(realmId) }), defaults);
}

async function fetchUsers(realmId: string, search: string, page: number) {
    const queryString = codec.encode(buildQuery(realmId, search, page));
    const response = await fetch(`/users?${queryString}`);
    return response.json();
}
```

Three details doing quiet work here:

- `currentFilters ?? defaultFilters` chooses the current filter node before query composition. Passing current and default filters as separate `mergeQueries` arguments would conjunct them; it would not replace the default.
- Filters merge as an **ordered logical AND**: the user's `name` filter and the scope's `realm.id` condition both survive. Fields and sort retain keyed left priority.
- Everything is **immutable**: merging never mutates its inputs, so `defaults` is safe as a module constant and fragments like the realm scope are safe to pass around as props.

When a UI control replaces a previous search or range, choose its current value before calling `defineQuery`; do not compose old and new UI values with `mergeQueries`. Once filters are part of a query, composition intentionally retains every predicate.

## Framework flavors

::: code-group

```vue [Vue]
<script setup lang="ts">
const props = defineProps<{ realmId: string }>();

const search = ref('');
const page = ref(1);

const queryString = computed(() =>
    codec.encode(buildQuery(props.realmId, search.value, page.value)));

watchEffect(async () => {
    users.value = (await (await fetch(`/users?${queryString.value}`)).json()).data;
});
</script>
```

```tsx [React]
function UserList({ realmId }: { realmId: string }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const queryString = useMemo(
        () => codec.encode(buildQuery(realmId, search, page)),
        [realmId, search, page],
    );

    useEffect(() => {
        fetch(`/users?${queryString}`)
            .then((r) => r.json())
            .then((json) => setUsers(json.data));
    }, [queryString]);

    // ...
}
```

:::

Because the encoded string is derived state, it also makes a perfect cache key for SWR/TanStack Query.

## Guarding the wire

The default expression dialect carries nested `or(...)` trees and repeated-field conditions. Operators without a URL grammar still throw a typed error rather than sending something with different semantics. Legacy simple encoding is available only as an explicit migration option; see the [URL codec reference](/packages/codec-url#legacy-simple-dialect).

Optionally, encode against the server's schema for early feedback; see [schema-aware transport](/guide/wire#schema-aware-transport).

## Next steps

- [Merging & Composition](/guide/merging-queries): exact merge semantics.
- [Building Queries](/guide/building-queries): the full input grammar.
