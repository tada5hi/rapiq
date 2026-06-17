<script setup lang="ts">
import { ref } from 'vue';

interface Tab {
    label: string;
    code: string;
}

const tabs: Tab[] = [
    {
        label: 'Install',
        code: `# client side — build & encode queries
npm install @rapiq/core @rapiq/codec-url-simple

# server side — parse, validate & translate
npm install @rapiq/core @rapiq/parser-simple @rapiq/sql`,
    },
    {
        label: 'Build (client)',
        code: `import {
    Filter, FilterCompoundOperator, FilterFieldOperator,
    Filters, Pagination, Query, Sort, Sorts,
} from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

const query = new Query({
    filters: new Filters(FilterCompoundOperator.AND, [
        new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18),
    ]),
    sorts: new Sorts([new Sort('age', 'DESC')]),
    pagination: new Pagination(25, 0),
});

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// → filter[age]=>=18&sort=-age&page[limit]=25`,
    },
    {
        label: 'Parse (server)',
        code: `import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';

const registry = new SchemaRegistry();
registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    sort: { allowed: ['id', 'name', 'age'] },
    pagination: { maxLimit: 50 },
}));

const parser = new SimpleParser(registry);
const query = parser.parse(req.query, { schema: 'user' });
// → typed Query AST, constrained by the schema`,
    },
];

const active = ref(0);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const copy = async (code: string) => {
    if (!navigator?.clipboard) return;
    try {
        await navigator.clipboard.writeText(code);
    } catch {
        // Clipboard API can reject in insecure contexts or on permission
        // denial — leave `copied` false so the button doesn't claim success.
        return;
    }
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied.value = false; }, 1500);
};
</script>

<template>
    <section class="rq-codetabs">
        <div class="rq-codetabs-inner">
            <h2 class="rq-codetabs-heading">
                From client to query in three steps
            </h2>
            <p class="rq-codetabs-sub">
                Build on the client, transport as a query string, parse &amp; validate on the server.
            </p>

            <div class="rq-codetabs-card">
                <div
                    class="rq-codetabs-tabs"
                    role="tablist"
                >
                    <button
                        v-for="(tab, i) in tabs"
                        :key="tab.label"
                        type="button"
                        class="rq-codetabs-tab"
                        :class="{ 'rq-codetabs-tab-active': active === i }"
                        :aria-selected="active === i"
                        role="tab"
                        @click="active = i"
                    >
                        {{ tab.label }}
                    </button>
                    <button
                        type="button"
                        class="rq-codetabs-copy"
                        @click="copy(tabs[active].code)"
                    >
                        {{ copied ? 'Copied' : 'Copy' }}
                    </button>
                </div>
                <pre class="rq-codetabs-pre"><code>{{ tabs[active].code }}</code></pre>
            </div>
        </div>
    </section>
</template>

<style scoped>
.rq-codetabs {
    padding: 4rem 1.5rem;
    background: var(--rq-color-bg);
}

.rq-codetabs-inner {
    max-width: 960px;
    margin: 0 auto;
}

.rq-codetabs-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    text-align: center;
    margin: 0 0 0.5rem;
}

.rq-codetabs-sub {
    text-align: center;
    color: var(--rq-color-fg-muted);
    margin: 0 0 2rem;
}

.rq-codetabs-card {
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--rq-color-bg);
}

.rq-codetabs-tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0;
    border-bottom: 1px solid var(--rq-color-border);
    background: var(--rq-color-bg-elevated);
}

.rq-codetabs-tab {
    padding: 0.5rem 0.875rem;
    border: none;
    background: transparent;
    color: var(--rq-color-fg-muted);
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem 0.375rem 0 0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}
.rq-codetabs-tab:hover { color: var(--rq-color-fg); }
.rq-codetabs-tab-active {
    color: var(--rq-color-fg);
    border-bottom-color: var(--rq-color-primary);
    background: var(--rq-color-bg);
}

.rq-codetabs-copy {
    margin-left: auto;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.375rem;
    background: transparent;
    font-size: 0.75rem;
    color: var(--rq-color-fg-muted);
    cursor: pointer;
    margin-bottom: 0.5rem;
    margin-right: 0.5rem;
}
.rq-codetabs-copy:hover { color: var(--rq-color-fg); }

.rq-codetabs-pre {
    padding: 1.25rem;
    margin: 0;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.6;
    background: var(--rq-color-bg);
    color: var(--rq-color-fg);
}
.rq-codetabs-pre code { font-family: ui-monospace, monospace; }
</style>
