<script setup lang="ts">
import { computed, ref } from 'vue';
import { createURLCodec } from '@rapiq/codec-url';
import { SimpleParser } from '@rapiq/parser-simple';
import {
    type DialectOptions,
    FiltersAdapter,
    FiltersVisitor,
    RelationsAdapter,
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '@rapiq/sql';

/*
 * The playground runs the real packages in the browser:
 * @rapiq/parser-simple turns the form state into a Query AST,
 * @rapiq/codec-url encodes it as a URL query string and
 * @rapiq/sql renders the WHERE clause for the selected dialect.
 */

interface Dialect {
    key: string,
    label: string,
    options: DialectOptions,
}

const dialects: Dialect[] = [
    { key: 'pg', label: 'Postgres', options: pg },
    { key: 'mysql', label: 'MySQL', options: mysql },
    { key: 'sqlite', label: 'SQLite', options: sqlite },
    { key: 'mssql', label: 'SQL Server', options: mssql },
    { key: 'oracle', label: 'Oracle', options: oracle },
];

const parser = new SimpleParser();
const codec = createURLCodec();

const name = ref('to');
const age = ref(21);
const sort = ref('-age');
const limit = ref(25);
const dialectKey = ref('pg');

const query = computed(() => parser.parse({
    fields: ['id', 'name', 'age'],
    filters: {
        ...(name.value ? { name: `~${name.value}~` } : {}),
        ...(Number.isFinite(age.value) ? { age: `>=${age.value}` } : {}),
    },
    sort: sort.value,
    pagination: { limit: limit.value },
}));

const urlOutput = computed(() => {
    const encoded = codec.encode(query.value);
    if (!encoded) {
        return '/users';
    }

    // Decode only the structural delimiters (`[`, `]`, `,`) for readability —
    // never the value content, so encoded separators inside a value (`%26`,
    // `%3D`) stay encoded and the displayed URL keeps its real wire format.
    return `/users?${encoded
        .replace(/%5B/g, '[')
        .replace(/%5D/g, ']')
        .replace(/%2C/g, ',')}`;
});

const sqlOutput = computed(() => {
    const dialect = dialects.find(
        (item) => item.key === dialectKey.value,
    ) || dialects[0];

    const filtersAdapter = new FiltersAdapter(
        new RelationsAdapter(),
        dialect.options,
    );

    let where : string;
    let params : unknown[];

    try {
        query.value.filters.accept(new FiltersVisitor(filtersAdapter));
        [where, params] = filtersAdapter.getQueryAndParameters();
    } catch (e) {
        // a dialect preset may reject an operator entirely —
        // e.g. mssql throws for regexp, which "contains" lowers to.
        return {
            text: '',
            params: [],
            error: e instanceof Error ? e.message : 'The dialect cannot render the current filters.',
        };
    }

    const { escapeField } = dialect.options;

    const fields = query.value.fields.value;
    const columns = fields.length > 0 ?
        fields.map((field) => escapeField(field.name)).join(', ') :
        '*';

    const lines = [
        `SELECT ${columns}`,
        `FROM ${escapeField('users')}`,
    ];

    if (where) {
        lines.push(`WHERE ${where}`);
    }

    const sorts = query.value.sorts.value;
    if (sorts.length > 0) {
        lines.push(`ORDER BY ${sorts.map(
            (item) => `${escapeField(item.name)} ${item.operator}`,
        ).join(', ')}`);
    }

    if (query.value.pagination.limit) {
        if (dialect.key === 'mssql') {
            lines.push(`OFFSET 0 ROWS FETCH NEXT ${query.value.pagination.limit} ROWS ONLY`);
        } else if (dialect.key === 'oracle') {
            lines.push(`FETCH FIRST ${query.value.pagination.limit} ROWS ONLY`);
        } else {
            lines.push(`LIMIT ${query.value.pagination.limit}`);
        }
    }

    return {
        text: lines.join('\n'),
        params,
        error: null,
    };
});
</script>

<template>
    <section class="rq-hero">
        <div class="rq-hero-inner">
            <div class="rq-hero-text">
                <h1 class="rq-hero-title">
                    <span class="rq-hero-title-grad">rapiq</span>
                </h1>
                <p class="rq-hero-tagline">
                    One query language between client &amp; server.
                    Build JSON:API-style queries on the client, parse them into a typed
                    AST against schema allow-lists on the server — and turn them into
                    SQL or TypeORM queries with composable adapters.
                </p>
                <div class="rq-hero-actions">
                    <a
                        class="rq-btn rq-btn-primary"
                        href="/guide/quick-start"
                    >Get Started</a>
                    <a
                        class="rq-btn rq-btn-ghost"
                        href="https://github.com/tada5hi/rapiq"
                        target="_blank"
                        rel="noopener"
                    >
                        View on GitHub
                    </a>
                </div>
            </div>

            <div class="rq-hero-card">
                <div class="rq-hero-card-toolbar">
                    <span
                        class="rq-hero-card-dot"
                        style="background: var(--rq-color-error)"
                    />
                    <span
                        class="rq-hero-card-dot"
                        style="background: var(--rq-color-warning)"
                    />
                    <span
                        class="rq-hero-card-dot"
                        style="background: var(--rq-color-success)"
                    />
                    <span class="rq-hero-card-name">playground</span>
                </div>

                <div class="rq-hero-card-body">
                    <div class="rq-hero-card-controls">
                        <label class="rq-hero-card-control">
                            <span>name contains</span>
                            <input
                                v-model="name"
                                type="text"
                                placeholder="…"
                            >
                        </label>
                        <label class="rq-hero-card-control">
                            <span>age ≥</span>
                            <input
                                v-model.number="age"
                                type="number"
                                min="0"
                            >
                        </label>
                        <label class="rq-hero-card-control">
                            <span>sort</span>
                            <select v-model="sort">
                                <option value="-age">age, descending</option>
                                <option value="age">age, ascending</option>
                                <option value="-name">name, descending</option>
                                <option value="name">name, ascending</option>
                            </select>
                        </label>
                        <label class="rq-hero-card-control">
                            <span>limit</span>
                            <select v-model.number="limit">
                                <option :value="10">10</option>
                                <option :value="25">25</option>
                                <option :value="50">50</option>
                            </select>
                        </label>
                    </div>

                    <p class="rq-hero-card-label">
                        SQL dialect
                    </p>
                    <div class="rq-hero-card-dialects">
                        <button
                            v-for="dialect in dialects"
                            :key="dialect.key"
                            type="button"
                            class="rq-hero-card-dialect"
                            :class="{ 'rq-hero-card-dialect-active': dialectKey === dialect.key }"
                            @click="dialectKey = dialect.key"
                        >
                            {{ dialect.label }}
                        </button>
                    </div>

                    <div class="rq-hero-card-output">
                        <div class="rq-hero-card-output-toolbar">
                            GET
                        </div>
                        <pre><code>{{ urlOutput }}</code></pre>
                    </div>

                    <div class="rq-hero-card-output">
                        <div class="rq-hero-card-output-toolbar">
                            SQL
                        </div>
                        <pre v-if="sqlOutput.error"
                            class="rq-hero-card-output-error"
                        ><code>-- {{ sqlOutput.error }}</code></pre>
                        <pre v-else><code>{{ sqlOutput.text }}</code></pre>
                        <div
                            v-if="sqlOutput.params.length > 0"
                            class="rq-hero-card-params"
                        >
                            -- params: {{ JSON.stringify(sqlOutput.params) }}
                        </div>
                    </div>

                    <p class="rq-hero-card-hint">
                        Live — <code>@rapiq/parser-simple</code>, <code>@rapiq/codec-url</code>
                        and <code>@rapiq/sql</code> are running in your browser.
                    </p>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.rq-hero {
    padding: 4rem 1.5rem 3rem;
    background:
        radial-gradient(1200px 600px at 100% 0%, color-mix(in oklab, var(--rq-color-primary) 12%, transparent), transparent),
        radial-gradient(800px 400px at 0% 100%, color-mix(in oklab, var(--rq-color-accent) 10%, transparent), transparent);
}

.rq-hero-inner {
    max-width: 1152px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
}

@media (min-width: 960px) {
    .rq-hero-inner { grid-template-columns: 1fr 1.1fr; gap: 4rem; }
}

.rq-hero-title {
    font-size: clamp(2.75rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 1.25rem;
}
.rq-hero-title-grad {
    background: linear-gradient(120deg, var(--rq-color-primary), var(--rq-color-accent));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.rq-hero-tagline {
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--rq-color-fg-muted);
    max-width: 36rem;
    margin: 0 0 2rem;
}

.rq-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.rq-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    border: 1px solid transparent;
    transition: background-color 120ms, color 120ms, border-color 120ms;
    cursor: pointer;
    text-decoration: none !important;
}

.rq-btn-primary {
    background: var(--rq-color-primary-strong);
    color: #fff;
}
.rq-btn-primary:hover { background: var(--rq-color-primary); }

.rq-btn-ghost {
    background: transparent;
    color: var(--rq-color-fg);
    border-color: var(--rq-color-border);
}
.rq-btn-ghost:hover {
    background: var(--rq-color-bg-elevated);
    border-color: var(--rq-color-fg-muted);
}

.rq-hero-card {
    border: 1px solid var(--rq-color-border);
    border-radius: 1rem;
    background: var(--rq-color-bg);
    box-shadow: 0 25px 50px -12px color-mix(in oklab, var(--rq-color-primary) 8%, rgba(0, 0, 0, 0.25));
    overflow: hidden;
}

.rq-hero-card-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--rq-color-border);
    background: var(--rq-color-bg-elevated);
}
.rq-hero-card-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 999px;
    display: inline-block;
}
.rq-hero-card-name {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--rq-color-fg-muted);
    font-family: ui-monospace, monospace;
}

.rq-hero-card-body { padding: 1.25rem; }

.rq-hero-card-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}

.rq-hero-card-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.rq-hero-card-control span {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: var(--rq-color-fg-muted);
}
.rq-hero-card-control input,
.rq-hero-card-control select {
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid var(--rq-color-border);
    background: var(--rq-color-bg);
    color: var(--rq-color-fg);
    font-size: 0.875rem;
}

.rq-hero-card-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: var(--rq-color-fg-muted);
    margin: 0 0 0.5rem;
}

.rq-hero-card-dialects {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 1.25rem;
}
.rq-hero-card-dialect {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--rq-color-border);
    background: transparent;
    color: var(--rq-color-fg-muted);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: border-color 120ms, color 120ms;
}
.rq-hero-card-dialect:hover { color: var(--rq-color-fg); }
.rq-hero-card-dialect-active {
    border-color: var(--rq-color-primary);
    color: var(--rq-color-primary);
    font-weight: 600;
}

.rq-hero-card-output {
    border: 1px solid var(--rq-color-border);
    border-radius: 0.5rem;
    background: var(--rq-color-bg-elevated);
    margin-bottom: 0.75rem;
    overflow: hidden;
}
.rq-hero-card-output-toolbar {
    padding: 0.25rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--rq-color-fg-muted);
    border-bottom: 1px solid var(--rq-color-border);
}
.rq-hero-card-output pre {
    margin: 0;
    padding: 0.625rem 0.75rem;
    overflow-x: auto;
    font-size: 0.75rem;
    line-height: 1.55;
    color: var(--rq-color-fg);
}
.rq-hero-card-output code { font-family: ui-monospace, monospace; }
.rq-hero-card-output-error code { color: var(--rq-color-error); }
.rq-hero-card-params {
    padding: 0 0.75rem 0.625rem;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    color: var(--rq-color-fg-muted);
}

.rq-hero-card-hint {
    font-size: 0.8125rem;
    color: var(--rq-color-fg-muted);
    margin: 0;
}
.rq-hero-card-hint code {
    background: var(--rq-color-bg-elevated);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8em;
}
</style>
