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
import { URLEncoder } from '@rapiq/codec-url-simple';
import type { User } from 'my-api-types';

const encoder = new URLEncoder();

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
    const queryString = encoder.encode(buildQuery(realmId, search, page));
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
    encoder.encode(buildQuery(props.realmId, search.value, page.value)));

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
        () => encoder.encode(buildQuery(realmId, search, page)),
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

The simple URL dialect can't carry `or(...)` trees or values that collide with operator markers — `encode` throws a typed error rather than sending something that means the wrong thing. If your UI produces compound filters, encode with the [expression codec](/packages/codec-url-expression) instead; the rest of this recipe is unchanged.

Optionally, encode against the server's schema for early feedback — see [schema-aware encoding](/guide/wire#schema-aware-encoding).

## Next steps

- [Merging & Composition](/guide/merging-queries) — exact merge semantics.
- [Building Queries](/guide/building-queries) — the full input grammar.
