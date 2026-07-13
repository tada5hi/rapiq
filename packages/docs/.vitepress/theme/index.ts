import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import PackageLayers from './components/PackageLayers.vue';
import QueryHub from './components/QueryHub.vue';
import QueryPipeline from './components/QueryPipeline.vue';

import './style.css';

/*
 * VitePress theme entry. The landing page (index.md) composes the
 * marketing components from ./components/ — they are imported there
 * directly. The diagram components below are used across guide pages,
 * so they register globally.
 */
export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('QueryPipeline', QueryPipeline);
        app.component('QueryHub', QueryHub);
        app.component('PackageLayers', PackageLayers);
    },
} satisfies Theme;
