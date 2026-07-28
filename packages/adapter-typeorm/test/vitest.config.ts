import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // TypeORM entities rely on legacy decorators + emitted design-type metadata,
    // which the default transform (Oxc) cannot produce — use SWC instead and
    // disable Oxc so it doesn't also transform (and strip) the metadata.
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
        // Against a real DB (DB_TYPE set) the specs share one persistent
        // database, so run files serially to avoid workers racing each other's
        // dropSchema/synchronize, and allow more time for container round-trips.
        // sqlite (:memory:, per-worker) keeps the default parallel fast path.
        fileParallelism: !process.env.DB_TYPE,
        testTimeout: process.env.DB_TYPE ? 30000 : 5000,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/**/*.d.ts'],
            thresholds: {
                branches: 58,
                functions: 77,
                lines: 73,
                statements: 73,
            },
        },
    },
});
