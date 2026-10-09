import { defineConfig } from 'vitest/config';

/**
 * The engine-backed suite: a generated prisma client executing the
 * emitted arguments against a real database. SQLite runs everywhere;
 * the postgres specs skip themselves unless `DB_TYPE=postgres` points
 * at a live server (the CI `tests-db` job provides one).
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/unit/**/*.db.spec.{ts,js}'],
        // one engine, one schema, one database file at a time
        fileParallelism: false,
    },
});
