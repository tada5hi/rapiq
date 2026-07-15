<script setup lang="ts">
/*
 * Dependency-layer figure for the package overview: each band builds
 * only on the bands above it. Chips link to the package pages and name
 * their direct internal (peer) dependencies.
 */
interface Pkg {
    name: string;
    href: string;
    deps?: string;
}

interface Layer {
    title: string;
    packages: Pkg[];
}

const layers: Layer[] = [
    {
        title: 'Foundation',
        packages: [
            { name: '@rapiq/core', href: '/packages/core' },
        ],
    },
    {
        title: 'Built on core',
        packages: [
            { name: '@rapiq/parser-simple', href: '/packages/parser-simple', deps: 'core' },
            { name: '@rapiq/sql', href: '/packages/sql', deps: 'core' },
            { name: '@rapiq/memory', href: '/packages/memory', deps: 'core' },
        ],
    },
    {
        title: 'Dialects & backends',
        packages: [
            { name: '@rapiq/parser-expression', href: '/packages/parser-expression', deps: 'parser-simple' },
            { name: '@rapiq/parser-mongo', href: '/packages/parser-mongo', deps: 'parser-simple' },
            { name: '@rapiq/typeorm', href: '/packages/typeorm', deps: 'sql + typeorm' },
        ],
    },
    {
        title: 'URL transport',
        packages: [
            { name: '@rapiq/codec-url', href: '/packages/codec-url', deps: 'parser-simple + parser-expression' },
        ],
    },
];
</script>

<template>
    <figure class="rq-layers">
        <div
            v-for="(layer, i) in layers"
            :key="layer.title"
            class="rq-layers-band"
        >
            <div
                v-if="i > 0"
                class="rq-layers-link"
                aria-hidden="true"
            />
            <span class="rq-layers-title">{{ layer.title }}</span>
            <div class="rq-layers-row">
                <a
                    v-for="p in layer.packages"
                    :key="p.name"
                    :href="p.href"
                    class="rq-layers-chip"
                >
                    <strong>{{ p.name }}</strong>
                    <span v-if="p.deps">needs {{ p.deps }}</span>
                </a>
            </div>
        </div>
        <figcaption class="rq-layers-caption">
            Each band depends only on the bands above it — internal
            dependencies are peer dependencies, so npm installs nothing
            you didn't ask for.
        </figcaption>
    </figure>
</template>

<style scoped>
.rq-layers {
    display: flex;
    flex-direction: column;
    margin: 1.5rem 0;
}

.rq-layers-band {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.rq-layers-title {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--rq-color-fg-muted);
    margin-bottom: 0.4rem;
}

.rq-layers-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.75rem;
    background: var(--rq-color-bg-muted);
}

.rq-layers-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.05rem;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--rq-color-border);
    border-radius: 0.55rem;
    background: var(--rq-color-bg);
    text-decoration: none !important;
    color: inherit;
    transition: border-color 120ms, transform 120ms;
}

.rq-layers-chip:hover {
    border-color: var(--rq-color-primary);
    transform: translateY(-1px);
}

.rq-layers-chip strong {
    font-size: 0.74rem;
}

.rq-layers-chip span {
    font-size: 0.66rem;
    color: var(--rq-color-fg-muted);
}

.rq-layers-link {
    width: 2px;
    height: 1.4rem;
    margin: 0.15rem 0;
    background: var(--rq-color-primary);
    opacity: 0.55;
}

.rq-layers-caption {
    margin-top: 0.75rem;
    font-size: 0.74rem;
    text-align: center;
    color: var(--rq-color-fg-muted);
}
</style>
