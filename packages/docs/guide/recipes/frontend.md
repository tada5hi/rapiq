# Type-Safe Frontend Queries

A list component typically owes its query to three sources at once: **defaults** it ships with, a **scope** its parent imposes via props, and **user input** from search/sort/pagination controls. This recipe composes the three declaratively — typed against the record, merged by rank, encoded on demand.

Works the same in Vue, React or plain TypeScript — rapiq has no framework dependency.

## Shared types

Share the record types (and nothing else) between frontend and backend — a types-only package or a generated client:

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

// 1. component defaults — shipped with the list
const defaults = defineQuery<User>({
    fields: ['id', 'name', 'email'],
    sort: '-id',
    pagination: { limit: 25 },
});

// 2. parent-imposed scope — realmId arrives as a prop / argument
//    (fragments are plain values, so they travel well as data)
function scopeFor(realmId: string) {
    return defineFilters<User>({ 'realm.id': realmId });
}

// 3. user input — from the search box & pager
function buildQuery(realmId: string, search: string, page: number) {
    const userInput = defineQuery<User>({
        filters: { name: { $contains: search || undefined } },
        pagination: { offset: (page - 1) * 25 },
    });

    // left wins: user input > scope > defaults
    return mergeQueries(userInput, defineQuery<User>({ filters: scopeFor(realmId) }), defaults);
}

async function fetchUsers(realmId: string, search: string, page: number) {
    const queryString = codec.encode(buildQuery(realmId, search, page));
    const response = await fetch(`/users?${queryString}`);
    return response.json();
}
```

Three details doing quiet work here:

- `{ $contains: search || undefined }` — an `undefined` operator value contributes **no condition**, so the empty search box simply doesn't filter. No `if`-shuffling around the query object.
- The merge is **per-field** for filters: the user's `name` filter never disturbs the scope's `realm.id` condition, and both survive alongside the defaults' sort and fields.
- Everything is **immutable** — merging never mutates its inputs, so `defaults` is safe as a module constant and fragments like the realm scope are safe to pass around as props.

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

Optionally, encode against the server's schema for early feedback — see [schema-aware transport](/guide/wire#schema-aware-transport).

## Next steps

- [Merging & Composition](/guide/merging-queries) — exact merge semantics.
- [Building Queries](/guide/building-queries) — the full input grammar.
