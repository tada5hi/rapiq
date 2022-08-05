import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Hapiq',
    base: '/',
    themeConfig: {
        socialLinks: [
            { icon: 'github', link: 'https://github.com/tada5hi/hapiq' },
        ],
        editLink: {
            pattern: 'https://github.com/tada5hi/hapiq/edit/master/docs/:path',
            text: 'Edit this page on GitHub'
        },
        nav: [
            {
                text: 'Home',
                link: '/',
                activeMatch: '/',
            },
            {
                text: 'Guide',
                link: '/guide/',
                activeMatch: '/guide/',
            }
        ],
        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    collapsible: false,
                    items: [
                        {text: 'What is it?', link: '/guide/'},
                    ]
                },
                {
                    text: 'Getting Started',
                    collapsible: false,
                    items: [
                        {text: 'Installation', link: '/guide/installation'},
                        {text: 'Build', link: '/guide/build'},
                        {text: 'Parse', link: '/guide/parse'},
                    ]
                },
                {
                    text: 'API Reference',
                    collapsible: false,
                    items: [
                        {text: 'Parameter', link: '/guide/parameter-api-reference'},
                        {text: 'Build', link: '/guide/build-api-reference'},
                        {text: 'Parse', link: '/guide/parse-api-reference'}
                    ]
                },
            ]
        }
    }
});
