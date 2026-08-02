<script setup lang="ts">
interface PackageCard {
    name: string;
    accent: string;
    href: string;
    summary: string;
    bullets: string[];
}

const packages: PackageCard[] = [
    {
        name: '@rapiq/core',
        accent: 'var(--rq-color-primary)',
        href: '/packages/core',
        summary: 'The foundation — query AST, typed build layer and the schema system everything else builds on.',
        bullets: [
            'defineQuery() + condition helpers (eq, and, or, …)',
            'defineSchema() + SchemaRegistry allow-lists',
            'Parser base classes & typed errors',
        ],
    },
    {
        name: '@rapiq/parser-simple',
        accent: 'var(--rq-color-accent)',
        href: '/packages/parser-simple',
        summary: 'Parses plain object/array input — the URL-query-like "simple" dialect.',
        bullets: [
            'Filters like { age: \'>=18\', name: \'~jo~\' }',
            'Schema validation while parsing',
            'Powers the URL decoder',
        ],
    },
    {
        name: '@rapiq/parser-expression',
        accent: 'var(--rq-color-primary)',
        href: '/packages/parser-expression',
        summary: 'Parses the function-call expression dialect into the same Query AST.',
        bullets: [
            'and(eq(name, \'John\'), gte(age, \'18\'))',
            'Nested or() / not() groups on the wire',
            'Default filter dialect of the URL codec',
        ],
    },
    {
        name: '@rapiq/parser-mongo',
        accent: 'var(--rq-color-success)',
        href: '/packages/parser-mongo',
        summary: 'Parses MongoDB-style filter documents with typed values.',
        bullets: [
            '{ age: { $gte: 18 } }, $and / $or / $not',
            '$elemMatch incl. the element-level form',
            'Grammar errors always throw typed',
        ],
    },
    {
        name: '@rapiq/codec-url',
        accent: 'var(--rq-color-warning)',
        href: '/packages/codec-url',
        summary: 'URL query-string codec — the transport between caller and receiver.',
        bullets: [
            'Expression filters by default',
            'Legacy simple-filter decoding',
            'Schema-aware encode & decode',
        ],
    },
    {
        name: '@rapiq/adapter-sql',
        accent: 'var(--rq-color-error)',
        href: '/packages/adapter-sql',
        summary: 'Dialect-agnostic SQL adapter turning the AST into parameterized fragments.',
        bullets: [
            'Presets: Postgres, MySQL, SQLite, MSSQL, Oracle',
            'Dialects are option objects, not subclasses',
            'Visitor-driven — fragments accumulate per parameter',
        ],
    },
    {
        name: '@rapiq/adapter-typeorm',
        accent: 'var(--rq-color-primary)',
        href: '/packages/adapter-typeorm',
        summary: 'Applies a parsed Query directly to a TypeORM SelectQueryBuilder.',
        bullets: [
            'Mutates the query builder in place',
            'Relations become joins automatically',
            'Builds on the @rapiq/adapter-sql visitors',
        ],
    },
    {
        name: '@rapiq/adapter-prisma',
        accent: 'var(--rq-color-accent)',
        href: '/packages/adapter-prisma',
        summary: 'Serializes a parsed Query into a Prisma findMany args object.',
        bullets: [
            'Pure value: no prisma dependency',
            'Same-element relation semantics preserved',
            'Engine-verified parity (SQLite & Postgres)',
        ],
    },
    {
        name: '@rapiq/adapter-drizzle',
        accent: 'var(--rq-color-warning)',
        href: '/packages/adapter-drizzle',
        summary: 'Serializes a parsed Query into a drizzle relational-queries findMany config.',
        bullets: [
            'Pure value: no drizzle dependency',
            'Correlated EXISTS relation filters',
            'Engine-verified parity in the default suite',
        ],
    },
    {
        name: '@rapiq/adapter-memory',
        accent: 'var(--rq-color-success)',
        href: '/packages/adapter-memory',
        summary: 'Evaluates the same Query against in-memory objects & arrays.',
        bullets: [
            'Filters compile to plain predicates',
            'SQL-parity semantics — guards agree with the database',
            'Perfect for authorization checks & tests',
        ],
    },
];
</script>

<template>
    <section class="rq-packages">
        <div class="rq-packages-inner">
            <h2 class="rq-packages-heading">
                One AST, one package family
            </h2>
            <p class="rq-packages-sub">
                rapiq is a family of focused, composable packages.
                Install only what each side of your application needs —
                everything meets in the core query AST.
                <a href="/packages/">Browse all packages →</a>
            </p>

            <div class="rq-packages-grid">
                <a
                    v-for="p in packages"
                    :key="p.name"
                    :href="p.href"
                    class="rq-package-card"
                    :style="{ '--accent': p.accent }"
                >
                    <h3 class="rq-package-name">{{ p.name }}</h3>
                    <p class="rq-package-summary">{{ p.summary }}</p>
                    <ul class="rq-package-list">
                        <li
                            v-for="b in p.bullets"
                            :key="b"
                        >{{ b }}</li>
                    </ul>
                    <span class="rq-package-cta">Read more →</span>
                </a>
            </div>
        </div>
    </section>
</template>

<style scoped>
.rq-packages {
    padding: 4rem 1.5rem;
    background: var(--rq-color-bg-muted);
}

.rq-packages-inner {
    max-width: 1152px;
    margin: 0 auto;
}

.rq-packages-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    text-align: center;
    margin: 0 0 0.75rem;
}

.rq-packages-sub {
    text-align: center;
    max-width: 38rem;
    margin: 0 auto 2.5rem;
    color: var(--rq-color-fg-muted);
}

.rq-packages-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
}

@media (min-width: 768px) {
    .rq-packages-grid { grid-template-columns: repeat(3, 1fr); }
}

.rq-package-card {
    --accent: var(--rq-color-primary);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    border: 1px solid var(--rq-color-border);
    border-top: 3px solid var(--accent);
    border-radius: 0.75rem;
    background: var(--rq-color-bg);
    text-decoration: none !important;
    color: inherit;
    transition: transform 120ms, border-color 120ms;
}
.rq-package-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
}

.rq-package-name {
    font-size: 1.125rem;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    margin: 0 0 0.5rem;
}

.rq-package-summary {
    font-size: 0.9375rem;
    color: var(--rq-color-fg-muted);
    margin: 0 0 1rem;
    line-height: 1.5;
}

.rq-package-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    flex: 1;
}
.rq-package-list li {
    padding: 0.375rem 0;
    font-size: 0.875rem;
    color: var(--rq-color-fg);
    border-bottom: 1px solid var(--rq-color-border-muted);
}
.rq-package-list li:last-child { border-bottom: none; }
.rq-package-list li::before {
    content: '✓';
    margin-right: 0.5rem;
    color: var(--accent);
    font-weight: 700;
}

.rq-package-cta {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
}
</style>
