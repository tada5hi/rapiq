import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.{spec,test}.{ts,js}'],
        // engine-backed specs need a generated prisma client, so they
        // live behind `test:db` (see test/vitest.db.config.ts) and the
        // default suite stays codegen-free.
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.db.spec.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/**/*.d.ts'],
        },
    },
});
