<script setup lang="ts">
interface Feature {
    icon: string;
    title: string;
    detail: string;
}

const features: Feature[] = [
    {
        icon: '🌐',
        title: 'JSON:API-style',
        detail: 'Fields, filters, relations, pagination & sort — one consistent query scheme based on the JSON:API specification.',
    },
    {
        icon: '🌲',
        title: 'Typed query AST',
        detail: 'Input parses into Query nodes that backends consume via the visitor pattern — new targets never touch core.',
    },
    {
        icon: '🛡️',
        title: 'Schema allow-lists',
        detail: 'Declare what clients may request — allowed keys, defaults, mappings. Disallowed input is dropped or throws.',
    },
    {
        icon: '🧩',
        title: 'Pluggable parsers',
        detail: 'Parse plain objects or an expression language — both dialects produce the exact same Query AST.',
    },
    {
        icon: '🗄️',
        title: 'SQL & TypeORM',
        detail: 'Render parameterized SQL for five dialects, or apply a Query straight to a TypeORM SelectQueryBuilder.',
    },
    {
        icon: '🔒',
        title: 'TypeScript-first',
        detail: 'Typed key paths via recursive NestedKeys<T> — allow-lists and defaults autocomplete against your records.',
    },
];
</script>

<template>
    <section class="rq-features">
        <div class="rq-features-inner">
            <h2 class="rq-features-heading">
                A pipeline, not a parser
            </h2>
            <div class="rq-features-grid">
                <article
                    v-for="f in features"
                    :key="f.title"
                    class="rq-feature"
                >
                    <div class="rq-feature-icon">
                        {{ f.icon }}
                    </div>
                    <h3 class="rq-feature-title">
                        {{ f.title }}
                    </h3>
                    <p class="rq-feature-detail">
                        {{ f.detail }}
                    </p>
                </article>
            </div>
        </div>
    </section>
</template>

<style scoped>
.rq-features {
    padding: 4rem 1.5rem;
    background: var(--rq-color-bg);
}

.rq-features-inner {
    max-width: 1152px;
    margin: 0 auto;
}

.rq-features-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 2.5rem;
    text-align: center;
}

.rq-features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
}

@media (min-width: 640px) {
    .rq-features-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 960px) {
    .rq-features-grid { grid-template-columns: repeat(3, 1fr); }
}

.rq-feature {
    padding: 1.5rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    background: var(--rq-color-bg);
    transition: border-color 120ms, transform 120ms;
}
.rq-feature:hover {
    border-color: var(--rq-color-primary);
    transform: translateY(-2px);
}

.rq-feature-icon {
    font-size: 1.75rem;
    margin-bottom: 0.75rem;
    line-height: 1;
}

.rq-feature-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
}

.rq-feature-detail {
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--rq-color-fg-muted);
    margin: 0;
}
</style>
