import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Rapiq',
    description: 'One query language between client & server: JSON:API-style queries, a typed AST, schema allow-lists and composable adapters for SQL, TypeORM, Prisma, Drizzle and in-memory data.',
    base: '/',
    lastUpdated: true,
    srcExclude: ['README.md'],

    head: [
        ['link', {
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/logo.svg',
        }],
        ['meta', { name: 'theme-color', content: '#a21caf' }],
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
                text: 'Guide',
                link: '/guide/',
                activeMatch: '/guide/',
            },
            {
                text: 'Packages',
                link: '/packages/',
                activeMatch: '/packages/',
            },
        ],
        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    items: [
                        { text: 'What is rapiq?', link: '/guide/' },
                        { text: 'Installation', link: '/guide/installation' },
                        { text: 'Quick Start', link: '/guide/quick-start' },
                    ],
                },
                {
                    text: 'Essentials',
                    items: [
                        { text: 'Core Concepts', link: '/guide/concepts' },
                        { text: 'Building Queries', link: '/guide/building-queries' },
                        { text: 'Schemas & Validation', link: '/guide/schemas' },
                        { text: 'Queries over the Wire', link: '/guide/wire' },
                        { text: 'Executing Queries', link: '/guide/executing-queries' },
                    ],
                },
                {
                    text: 'Query Parameters',
                    collapsed: false,
                    items: [
                        { text: 'Fields', link: '/guide/fields' },
                        { text: 'Filters', link: '/guide/filters' },
                        { text: 'Relations', link: '/guide/relations' },
                        { text: 'Sorts', link: '/guide/sort' },
                        { text: 'Pagination', link: '/guide/pagination' },
                    ],
                },
                {
                    text: 'Digging Deeper',
                    items: [
                        { text: 'Merging & Composition', link: '/guide/merging-queries' },
                        { text: 'Error Handling', link: '/guide/errors' },
                        { text: 'The Query AST', link: '/guide/query-ast' },
                    ],
                },
                {
                    text: 'Recipes',
                    items: [
                        { text: 'Overview', link: '/guide/recipes/' },
                        { text: 'Type-Safe Frontend Queries', link: '/guide/recipes/frontend' },
                        { text: 'REST API with Express & TypeORM', link: '/guide/recipes/express-typeorm' },
                        { text: 'Swapping the Backend: Prisma & Drizzle', link: '/guide/recipes/prisma-drizzle' },
                        { text: 'MongoDB-Style Search Endpoint', link: '/guide/recipes/mongo-search' },
                        { text: 'Testing with the Memory Adapter', link: '/guide/recipes/testing-memory' },
                        { text: 'Authorization & Scoping', link: '/guide/recipes/authorization' },
                    ],
                },
                {
                    text: 'Migration',
                    collapsed: true,
                    items: [
                        { text: 'From rapiq v1', link: '/guide/migration-v1' },
                        { text: 'From typeorm-extension', link: '/guide/migration-typeorm-extension' },
                    ],
                },
            ],
            '/packages/': [
                {
                    text: 'Packages',
                    items: [
                        { text: 'Overview', link: '/packages/' },
                        { text: '@rapiq/core', link: '/packages/core' },
                    ],
                },
                {
                    text: 'Parsers',
                    items: [
                        { text: '@rapiq/parser-simple', link: '/packages/parser-simple' },
                        { text: '@rapiq/parser-expression', link: '/packages/parser-expression' },
                        { text: '@rapiq/parser-mongo', link: '/packages/parser-mongo' },
                    ],
                },
                {
                    text: 'URL Codec',
                    items: [
                        { text: '@rapiq/codec-url', link: '/packages/codec-url' },
                    ],
                },
                {
                    text: 'Backend Adapters',
                    items: [
                        { text: '@rapiq/adapter-sql', link: '/packages/adapter-sql' },
                        { text: '@rapiq/adapter-typeorm', link: '/packages/adapter-typeorm' },
                        { text: '@rapiq/adapter-prisma', link: '/packages/adapter-prisma' },
                        { text: '@rapiq/adapter-drizzle', link: '/packages/adapter-drizzle' },
                        { text: '@rapiq/adapter-memory', link: '/packages/adapter-memory' },
                    ],
                },
            ],
        },

        outline: {
            level: [2, 3],
        },

        search: { provider: 'local' },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2021-present Peter Placzek',
        },
    }
});
