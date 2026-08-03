# Recipes

*Chapter 1 of the recipes storyline: the map. One small API is built through every layer of rapiq; start here, then read in order or jump to the layer you want to swap. Next: [Type-Safe Frontend Queries](/guide/recipes/frontend).*

The recipes tell one continuous story over one running example: a realm/user API whose clients list, filter, sort, page and expand `/users`. Each chapter owns exactly one layer of the pipeline, so the section reads front to back, but every chapter also stands alone if you arrive with a specific problem.

## The running example

Two record types, shared by all chapters:

```typescript
export type Realm = {
    id: string,
    name: string,
};

export type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: Realm,
};
```

The server declares what clients may request in a schema module (`src/schema.ts`) and shares one URL codec (`src/codec.ts`). Both are defined once in [chapter 3](/guide/recipes/express-typeorm) and reused verbatim by every later chapter: that reuse is the point of the story.

## The pipeline

```txt
defineQuery<User>({ ... })            the caller builds a typed query     chapter 2
        │  codec.encode()
        ▼
?codec=url-expression&filter=...      one ordinary URL query string
        │  HTTP
        ▼
codec.decode(req.query, { schema })   validated against the contract      chapter 3
        │                             (chapter 5 swaps in a mongo parser)
        ▼
adapter.execute(query)                your backend runs it                chapters 3, 4, 6
```

## The chapters

1. **You are here.** The map and the running example.
2. [Type-Safe Frontend Queries](/guide/recipes/frontend) owns the **client layer**: component defaults, parent-imposed scope and user input, composed with `defineQuery` and `mergeQueries` and encoded on demand.
3. [REST API with Express & TypeORM](/guide/recipes/express-typeorm) is the **server baseline**: schemas as the contract, the shared codec, TypeORM execution, the response `meta` envelope and clean 400s.
4. [Swapping the Backend: Prisma & Drizzle](/guide/recipes/prisma-drizzle) swaps the **execute layer**: same contract, same codec, same route shape; only the adapter changes.
5. [MongoDB-Style Search Endpoint](/guide/recipes/mongo-search) swaps the **input dialect**: a POST search endpoint feeds MongoDB-style filter documents through `@rapiq/parser-mongo` into the same schema and the same adapter.
6. [Testing with the Memory Adapter](/guide/recipes/testing-memory) replaces the database with **compiled functions**: `@rapiq/adapter-memory` runs the same contract against fixture arrays, so endpoint behavior is testable without infrastructure.
7. [Authorization & Scoping](/guide/recipes/authorization) is the **cross-cutting chapter**: per-actor gates at decode time, injected scope conditions, row-scoped column access and in-memory guards, layered over everything the previous chapters built.

New to rapiq? Read the [Quick Start](/guide/quick-start) first: the recipes assume the vocabulary introduced there.
