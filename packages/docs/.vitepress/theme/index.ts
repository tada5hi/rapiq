import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import './style.css';

/*
 * VitePress theme entry. The landing page (index.md) composes the
 * marketing components from ./components/ — they are imported there
 * directly, so nothing needs to be registered globally here.
 */
export default {
    extends: DefaultTheme,
} satisfies Theme;
