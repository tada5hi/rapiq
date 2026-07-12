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
        name: '@rapiq/codec-url-simple',
        accent: 'var(--rq-color-warning)',
        href: '/packages/codec-url-simple',
        summary: 'URL query-string codec — the transport between caller and receiver.',
        bullets: [
            'URLEncoder: Query AST → query string',
            'URLDecoder: query string → Query AST',
            'JSON:API-style parameter names',
        ],
    },
    {
        name: '@rapiq/sql',
        accent: 'var(--rq-color-error)',
        href: '/packages/sql',
        summary: 'Dialect-agnostic SQL adapter turning the AST into parameterized fragments.',
        bullets: [
            'Presets: Postgres, MySQL, SQLite, MSSQL, Oracle',
            'Dialects are option objects, not subclasses',
            'Visitor-driven — fragments accumulate per parameter',
        ],
    },
    {
        name: '@rapiq/typeorm',
        accent: 'var(--rq-color-primary)',
        href: '/packages/typeorm',
        summary: 'Applies a parsed Query directly to a TypeORM SelectQueryBuilder.',
        bullets: [
            'Mutates the query builder in place',
            'Relations become joins automatically',
            'Builds on the @rapiq/sql visitors',
        ],
    },
    {
        name: '@rapiq/memory',
        accent: 'var(--rq-color-success)',
        href: '/packages/memory',
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
