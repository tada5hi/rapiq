import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The TypeORM fixture entities rely on legacy decorators and emitted
    // design-type metadata, which the default transform (Oxc) cannot produce:
    // use SWC instead and disable Oxc so it does not strip the metadata again.
    oxc: false,
    plugins: [
        swc.vite({
            jsc: {
                parser: { syntax: 'typescript', decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
                target: 'es2022',
            },
        }),
    ],
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['reflect-metadata'],
        include: ['test/unit/**/*.{spec,test}.{ts,js}'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/**/*.d.ts'],
        },
    },
});
