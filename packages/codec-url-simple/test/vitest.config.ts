import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.{spec,test}.{ts,js}'],
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
