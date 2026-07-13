<script setup lang="ts">
/*
 * The end-to-end pipeline figure: caller builds & encodes, the wire
 * carries a plain query string, the receiver decodes against a schema
 * and executes through an adapter.
 */
</script>

<template>
    <figure class="rq-pipe">
        <div
            class="rq-pipe-zone"
            data-side="caller"
        >
            <span class="rq-pipe-zone-label">Caller</span>

            <div class="rq-pipe-node">
                <span class="rq-pipe-node-title">Build</span>
                <code class="rq-pipe-node-code">defineQuery&lt;User&gt;({ filters, sort, … })</code>
                <span class="rq-pipe-node-sub">typed input · condition helpers <code>eq / and / or</code></span>
            </div>

            <div class="rq-pipe-arrow">
                <span class="rq-pipe-arrow-label">encode — <code>URLEncoder</code></span>
            </div>
        </div>

        <div class="rq-pipe-wire">
            <span class="rq-pipe-wire-label">HTTP</span>
            <code>?filter[age]=&gt;=18&amp;include=realm&amp;sort=-age&amp;page[limit]=25</code>
        </div>

        <div
            class="rq-pipe-zone"
            data-side="receiver"
        >
            <span class="rq-pipe-zone-label">Receiver</span>

            <div class="rq-pipe-arrow">
                <span class="rq-pipe-arrow-label">decode — <code>URLDecoder</code> / parsers</span>
            </div>

            <div class="rq-pipe-node">
                <span class="rq-pipe-node-title">Validate</span>
                <span class="rq-pipe-node-sub">
                    checked against the <strong>Schema</strong> allow-list —
                    anything not permitted is dropped or rejected
                </span>
            </div>

            <div class="rq-pipe-arrow" />

            <div class="rq-pipe-node rq-pipe-node-query">
                <span class="rq-pipe-node-title">Query</span>
                <span class="rq-pipe-node-sub">the shared, typed AST — same shape on both sides</span>
            </div>

            <div class="rq-pipe-arrow">
                <span class="rq-pipe-arrow-label">execute — <code>accept(visitor)</code></span>
            </div>

            <div class="rq-pipe-adapters">
                <a
                    class="rq-pipe-adapter"
                    href="/packages/typeorm"
                >
                    <strong>@rapiq/typeorm</strong>
                    <span>SelectQueryBuilder</span>
                </a>
                <a
                    class="rq-pipe-adapter"
                    href="/packages/sql"
                >
                    <strong>@rapiq/sql</strong>
                    <span>SQL fragments</span>
                </a>
                <a
                    class="rq-pipe-adapter"
                    href="/packages/memory"
                >
                    <strong>@rapiq/memory</strong>
                    <span>plain functions</span>
                </a>
            </div>
        </div>
    </figure>
</template>

<style scoped>
.rq-pipe {
    margin: 1.5rem 0;
    display: flex;
    flex-direction: column;
}

/* zones ------------------------------------------------------------ */

.rq-pipe-zone {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 1rem 0.75rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    background: var(--rq-color-bg-muted);
}

.rq-pipe-zone[data-side="receiver"] {
    padding-top: 1.5rem;
}

.rq-pipe-zone-label {
    position: absolute;
    top: -0.7rem;
    left: 1rem;
    padding: 0.1rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rq-color-primary);
    background: var(--rq-color-bg);
    border: 1px solid var(--rq-color-border);
    border-radius: 999px;
}

/* nodes ------------------------------------------------------------ */

.rq-pipe-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    width: min(100%, 30rem);
    padding: 0.6rem 1rem;
    text-align: center;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.6rem;
    background: var(--rq-color-bg);
}

.rq-pipe-node-query {
    border-color: var(--rq-color-primary);
    box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.rq-pipe-node-title {
    font-size: 0.8rem;
    font-weight: 700;
}

.rq-pipe-node-query .rq-pipe-node-title {
    color: var(--rq-color-primary);
    font-size: 0.9rem;
}

.rq-pipe-node-code {
    font-size: 0.75rem;
    color: var(--rq-color-fg);
}

.rq-pipe-node-sub {
    font-size: 0.72rem;
    line-height: 1.4;
    color: var(--rq-color-fg-muted);
}

.rq-pipe-node-sub code,
.rq-pipe-arrow-label code {
    font-size: 0.95em;
}

/* arrows ----------------------------------------------------------- */

.rq-pipe-arrow {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 1.9rem;
    padding: 0.2rem 0;
}

.rq-pipe-arrow::before {
    content: '';
    width: 2px;
    align-self: stretch;
    background: var(--rq-color-primary);
    opacity: 0.55;
}

.rq-pipe-arrow::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -1px;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--rq-color-primary);
    opacity: 0.75;
}

.rq-pipe-arrow-label {
    position: absolute;
    left: calc(50% + 0.75rem);
    white-space: nowrap;
    font-size: 0.72rem;
    color: var(--rq-color-fg-muted);
}

/* the wire ---------------------------------------------------------- */

.rq-pipe-wire {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.35rem 0.75rem;
    padding: 0.5rem 0.9rem;
    border: 1px dashed var(--rq-color-primary);
    border-radius: 0.6rem;
    background: var(--vp-c-brand-soft);
    overflow-x: auto;
}

.rq-pipe-wire-label {
    flex-shrink: 0;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--rq-color-primary);
}

.rq-pipe-wire code {
    font-size: 0.74rem;
    white-space: nowrap;
    color: var(--rq-color-fg);
    background: none;
    padding: 0;
}

/* adapters ---------------------------------------------------------- */

.rq-pipe-adapters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
    width: min(100%, 34rem);
    margin-bottom: 0.35rem;
}

.rq-pipe-adapter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.55rem 0.5rem;
    text-align: center;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.6rem;
    background: var(--rq-color-bg);
    text-decoration: none !important;
    color: inherit;
    transition: border-color 120ms, transform 120ms;
}

.rq-pipe-adapter:hover {
    border-color: var(--rq-color-primary);
    transform: translateY(-1px);
}

.rq-pipe-adapter strong {
    font-size: 0.72rem;
}

.rq-pipe-adapter span {
    font-size: 0.68rem;
    color: var(--rq-color-fg-muted);
}

/* responsive -------------------------------------------------------- */

@media (max-width: 560px) {
    .rq-pipe-arrow-label {
        position: static;
        white-space: normal;
        text-align: center;
    }

    .rq-pipe-arrow::after {
        display: none;
    }

    .rq-pipe-arrow::before {
        display: none;
    }

    .rq-pipe-adapters {
        grid-template-columns: 1fr;
    }
}
</style>
