import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Rapiq',
    description: 'One query language between client & server — JSON:API-style queries, a typed AST, schema allow-lists and composable SQL/TypeORM adapters.',
    base: '/',
    lastUpdated: true,

    head: [
        ['link', {
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/logo.svg',
        }],
        ['meta', { name: 'theme-color', content: '#7c3aed' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'rapiq' }],
        ['meta', { property: 'og:description', content: 'One query language between client & server.' }],
        ['meta', { property: 'og:url', content: 'https://rapiq.tada5hi.net/' }],
    ],

    themeConfig: {
        logo: '/logo.svg',

        socialLinks: [
            { icon: 'github', link: 'https://github.com/tada5hi/rapiq' },
        ],
        editLink: {
            pattern: 'https://github.com/tada5hi/rapiq/edit/master/packages/docs/:path',
            text: 'Edit this page on GitHub'
        },
        nav: [
            {
                text: 'Getting Started',
                link: '/getting-started/',
                activeMatch: '/getting-started/',
            },
            {
                text: 'Guide',
                link: '/guide/',
                activeMatch: '/guide/',
            },
            {
                text: 'Integrations',
                link: '/integrations/',
                activeMatch: '/integrations/',
            },
        ],
        sidebar: {
            '/getting-started/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Introduction', link: '/getting-started/' },
                        { text: 'Installation', link: '/getting-started/installation' },
                        { text: 'Quick Start', link: '/getting-started/quick-start' },
                    ],
                },
            ],
            '/guide/': [
                {
                    text: 'Concepts',
                    items: [
                        { text: 'Overview', link: '/guide/' },
                        { text: 'Query AST', link: '/guide/query' },
                        { text: 'Building Queries', link: '/guide/build' },
                        { text: 'Merging Queries', link: '/guide/merge' },
                        { text: 'Schemas', link: '/guide/schema' },
                    ],
                },
                {
                    text: 'Parameters',
                    items: [
                        { text: 'Fields', link: '/guide/fields' },
                        { text: 'Filters', link: '/guide/filters' },
                        { text: 'Pagination', link: '/guide/pagination' },
                        { text: 'Relations', link: '/guide/relations' },
                        { text: 'Sort', link: '/guide/sort' },
                    ],
                },
                {
                    text: 'Migration',
                    items: [
                        { text: 'Migration from v1', link: '/guide/migration' },
                    ],
                },
            ],
            '/integrations/': [
                {
                    text: 'Integrations',
                    items: [
                        { text: 'Overview', link: '/integrations/' },
                        { text: 'Simple Parser', link: '/integrations/simple' },
                        { text: 'Expression Parser', link: '/integrations/expression' },
                        { text: 'URL Codec', link: '/integrations/url' },
                        { text: 'SQL', link: '/integrations/sql' },
                        { text: 'TypeORM', link: '/integrations/typeorm' },
                    ],
                },
            ],
        },

        search: { provider: 'local' },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2021-present Peter Placzek',
        },
    }
});
