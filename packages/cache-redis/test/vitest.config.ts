import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.{spec,test}.{ts,js}'],
        // every spec file flushes the one Redis database it shares with the
        // others, so two files in parallel workers would flush under each other.
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/**/*.d.ts'],
        },
    },
});
