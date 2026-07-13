<script setup lang="ts">
const code = `import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = repository.createQueryBuilder('user');

const adapter = new TypeormAdapter({ queryBuilder });
adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();`;
</script>

<template>
    <section class="rq-typeorm">
        <div class="rq-typeorm-inner">
            <div class="rq-typeorm-text">
                <p class="rq-typeorm-eyebrow">
                    @rapiq/typeorm
                </p>
                <h2 class="rq-typeorm-heading">
                    Straight into TypeORM
                </h2>
                <p class="rq-typeorm-tagline">
                    Apply a parsed Query directly to a SelectQueryBuilder —
                    the adapter walks the AST and mutates the builder, nothing
                    is stringified twice.
                </p>
                <ul class="rq-typeorm-list">
                    <li><strong>TypeormAdapter</strong> — wraps any SelectQueryBuilder</li>
                    <li><strong>Visitor-driven</strong> — reuses the @rapiq/sql visitors</li>
                    <li><strong>Relations → joins</strong> — allowed relations join automatically</li>
                    <li><strong>Parameterized</strong> — filter values bind as parameters, never interpolated</li>
                </ul>
                <a
                    class="rq-btn rq-btn-primary"
                    href="/packages/typeorm"
                >Read the TypeORM guide →</a>
            </div>

            <div class="rq-typeorm-code">
                <div class="rq-typeorm-code-toolbar">
                    <span>controller.ts</span>
                </div>
                <pre><code>{{ code }}</code></pre>
            </div>
        </div>
    </section>
</template>

<style scoped>
.rq-typeorm {
    padding: 4rem 1.5rem;
    background: var(--rq-color-bg-muted);
}
.rq-typeorm-inner {
    max-width: 1152px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
}
@media (min-width: 960px) {
    .rq-typeorm-inner { grid-template-columns: 1fr 1fr; gap: 4rem; }
}

.rq-typeorm-eyebrow {
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--rq-color-primary);
    margin: 0 0 0.75rem;
    font-family: ui-monospace, monospace;
}

.rq-typeorm-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
}

.rq-typeorm-tagline {
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--rq-color-fg-muted);
    margin: 0 0 1.25rem;
}

.rq-typeorm-list {
    list-style: none;
    padding: 0;
    margin: 0 0 2rem;
}
.rq-typeorm-list li {
    padding: 0.5rem 0;
    color: var(--rq-color-fg);
    font-size: 0.9375rem;
    border-bottom: 1px solid var(--rq-color-border-muted);
}
.rq-typeorm-list li:last-child { border-bottom: none; }
.rq-typeorm-list strong { color: var(--rq-color-primary); font-weight: 600; }

.rq-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none !important;
    transition: background-color 120ms;
}
.rq-btn-primary {
    background: var(--rq-color-primary-strong);
    color: #fff;
}
.rq-btn-primary:hover { background: var(--rq-color-primary); }

.rq-typeorm-code {
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--rq-color-bg-elevated);
}
.rq-typeorm-code-toolbar {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--rq-color-border);
    font-size: 0.75rem;
    color: var(--rq-color-fg-muted);
    font-family: ui-monospace, monospace;
}
.rq-typeorm-code pre {
    margin: 0;
    padding: 1.25rem;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: var(--rq-color-fg);
}
.rq-typeorm-code code { font-family: ui-monospace, monospace; }
</style>
