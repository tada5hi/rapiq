import { defineConfig } from 'vitest/config';

/**
 * The live-server engine suite: the emitted config objects executed
 * against PostgreSQL, where `ilike` exists and the case contract can
 * be measured. The specs skip themselves unless `DB_TYPE=postgres`
 * points at a live server (the CI `tests-db` job provides one).
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.db.spec.{ts,js}'],
        // one server, one schema at a time
        fileParallelism: false,
    },
});
