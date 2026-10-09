import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.{spec,test}.{ts,js}'],
        // the postgres engine specs need a live server, so they live
        // behind `test:db` (see test/vitest.db.config.ts); the sqlite
        // engine runs in-memory and stays in the default suite.
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.db.spec.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/**/*.d.ts'],
        },
    },
});
