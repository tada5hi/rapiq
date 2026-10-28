import { defineConfig } from 'tsdown';

export default defineConfig({
    // the write side is its own entry, so the root types never import
    // from the optional `typeorm` peer.
    entry: {
        index: 'src/index.ts',
        typeorm: 'src/typeorm/index.ts',
    },
    format: 'esm',
    dts: true,
    sourcemap: true,
    tsconfig: 'tsconfig.build.json',
});
