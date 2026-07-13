<script setup lang="ts">
/*
 * The "Query is the hub" figure for the Core Concepts page:
 * producers on the left, the shared AST in the middle, consumers on
 * the right — with the schema constraining what parsers let through.
 */
</script>

<template>
    <figure class="rq-hub">
        <div class="rq-hub-col">
            <span class="rq-hub-col-title">produce</span>

            <div class="rq-hub-item">
                <strong>defineQuery</strong>
                <span>typed input, condition helpers</span>
            </div>
            <div class="rq-hub-item">
                <strong>URL codecs</strong>
                <span>decode query strings</span>
            </div>
            <div class="rq-hub-item">
                <strong>Parsers</strong>
                <span>simple · expression · mongo</span>
            </div>

            <div class="rq-hub-schema">
                <strong>Schema</strong>
                <span>allow-list — constrains parsing</span>
            </div>
        </div>

        <div
            class="rq-hub-flow"
            aria-hidden="true"
        />

        <div class="rq-hub-center">
            <span class="rq-hub-center-title">Query</span>
            <span class="rq-hub-center-sub">the shared AST</span>
        </div>

        <div
            class="rq-hub-flow"
            aria-hidden="true"
        />

        <div class="rq-hub-col">
            <span class="rq-hub-col-title">consume</span>

            <div class="rq-hub-item">
                <strong>@rapiq/typeorm</strong>
                <span>SelectQueryBuilder</span>
            </div>
            <div class="rq-hub-item">
                <strong>@rapiq/sql</strong>
                <span>parameterized fragments</span>
            </div>
            <div class="rq-hub-item">
                <strong>@rapiq/memory</strong>
                <span>compiled functions</span>
            </div>

            <div class="rq-hub-item">
                <strong>URL codecs</strong>
                <span>encode for transport</span>
            </div>
        </div>
    </figure>
</template>

<style scoped>
.rq-hub {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin: 1.5rem 0;
    padding: 1.25rem 1rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    background: var(--rq-color-bg-muted);
}

.rq-hub-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
}

.rq-hub-col-title {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    color: var(--rq-color-fg-muted);
}

.rq-hub-item,
.rq-hub-schema {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.55rem;
    background: var(--rq-color-bg);
}

.rq-hub-item strong,
.rq-hub-schema strong {
    font-size: 0.74rem;
}

.rq-hub-item span,
.rq-hub-schema span {
    font-size: 0.68rem;
    color: var(--rq-color-fg-muted);
}

.rq-hub-schema {
    border-style: dashed;
    border-color: var(--rq-color-warning);
    margin-top: 0.25rem;
}

/* connectors -------------------------------------------------------- */

.rq-hub-flow {
    position: relative;
    width: 2.75rem;
    flex-shrink: 0;
    align-self: center;
    height: 2px;
    background: var(--rq-color-primary);
    opacity: 0.55;
}

.rq-hub-flow::after {
    content: '';
    position: absolute;
    right: -1px;
    top: 50%;
    transform: translateY(-50%);
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 6px solid var(--rq-color-primary);
}

/* the hub ------------------------------------------------------------ */

.rq-hub-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    align-self: center;
    flex-shrink: 0;
    padding: 1rem 1.4rem;
    border: 1px solid var(--rq-color-primary);
    border-radius: 0.75rem;
    background: var(--rq-color-bg);
    box-shadow: 0 0 0 4px var(--vp-c-brand-soft);
}

.rq-hub-center-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--rq-color-primary);
}

.rq-hub-center-sub {
    font-size: 0.68rem;
    color: var(--rq-color-fg-muted);
}

/* responsive --------------------------------------------------------- */

@media (max-width: 640px) {
    .rq-hub {
        flex-direction: column;
        gap: 0.75rem;
    }

    .rq-hub-flow {
        width: 2px;
        height: 1.75rem;
        align-self: center;
    }

    .rq-hub-flow::after {
        right: auto;
        top: auto;
        left: 50%;
        bottom: -1px;
        transform: translateX(-50%);
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid var(--rq-color-primary);
        border-bottom: none;
    }
}
</style>
