import { defineConfig } from 'tsdown';

export default defineConfig({
    // Node and browser entries share chunks; the napi loader stays external
    // so its relative require of the addon resolves from binding/
    entry: ['src/index.ts', 'src/browser.ts'],
    // the WASM platform package is resolved by the consumer's bundler
    external: [/binding\/index\.cjs$/, '@rapiq/core-wasm32-wasip1'],
    format: 'esm',
    dts: true,
    sourcemap: true,
    tsconfig: 'tsconfig.build.json',
});
