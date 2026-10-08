/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Compares the TypeScript reference with the Rust port behind the napi
 * binding. Separates the engine from the JSON boundary: "rust (records
 * pre-serialized)" is what a caller holding JSON text (an HTTP body, a
 * file) pays; "rust (stringify per call)" includes JSON.stringify.
 *
 * Run (after `npm run build` and building crates/rapiq-node):
 *   node --experimental-strip-types crates/conformance/scripts/bench.ts
 */

/* eslint-disable no-console */

import { performance } from 'node:perf_hooks';
import { compileFilters as compileReference } from '@rapiq/adapter-memory';
import { ExpressionFiltersParser } from '@rapiq/parser-expression';
import * as rust from '../../rapiq-node/index.js';
import { toIR } from '../src/ir.ts';

function median(values: number[]) : number {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)] as number;
}

function measure(label: string, iterations: number, fn: () => unknown) : number {
    for (let i = 0; i < Math.min(iterations, 50); i++) {
        fn();
    }

    const runs : number[] = [];
    for (let run = 0; run < 7; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            fn();
        }
        runs.push((performance.now() - start) / iterations);
    }

    const value = median(runs);
    console.log(`  ${label.padEnd(44)} ${(value * 1000).toFixed(2).padStart(12)} µs/op`);

    return value;
}

// -----------------------------------------------------------

const expression = 'and(or(eq(name, \'Peter\'), startsWith(email, \'admin@\')), gte(age, \'18\'), ' +
    'elemMatch(items, and(eq(active, \'true\'), in(kind, \'book\', \'game\'))), not(contains(tags, \'spam\')))';

console.log(`\nparse (${expression.length} chars)`);
const parser = new ExpressionFiltersParser();
measure('typescript parse()', 20_000, () => parser.parse(expression));
measure('rust parse() (IR JSON string)', 20_000, () => rust.binding.parseExpressionFilters(expression));
measure('rust parse() + JSON.parse', 20_000, () => rust.parseExpressionFilters(expression));

// -----------------------------------------------------------

const count = 100_000;
const names = ['Peter', 'peter', 'Hans', 'Anna', 'admin'];
const kinds = ['book', 'game', 'tool'];
const records = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: names[i % names.length],
    email: i % 7 === 0 ? `admin@${i}.test` : `user${i}@example.test`,
    age: i % 60,
    tags: i % 11 === 0 ? ['spam', 'x'] : ['x', 'y'],
    items: Array.from({ length: (i % 4) + 1 }, (_, j) => ({
        kind: kinds[(i + j) % kinds.length],
        active: (i + j) % 3 === 0,
    })),
}));
const recordsJson = JSON.stringify(records);

const condition = parser.parse(expression);
const ir = toIR(condition);

const reference = compileReference(condition);
const compiled = rust.compileFilters(ir);
const native = new rust.binding.Predicate(JSON.stringify(ir));

const expected = records.filter((record) => reference(record)).length;
const actual = compiled.filter(records).length;
if (expected !== actual) {
    throw new Error(`verdict mismatch: typescript ${expected}, rust ${actual}`);
}

console.log(`\nfilter ${count} records (${expected} match, ${(recordsJson.length / 1e6).toFixed(1)} MB JSON)`);
const ts = measure('typescript records.filter(predicate)', 5, () => records.filter((record) => reference(record)));
const tsText = measure('typescript JSON.parse + filter', 5, () => (JSON.parse(recordsJson) as typeof records)
    .filter((record) => reference(record)));
const pre = measure('rust (records pre-serialized)', 5, () => native.filterIndices(recordsJson));
const full = measure('rust (stringify per call)', 5, () => compiled.filter(records));
measure('JSON.stringify(records) alone', 5, () => JSON.stringify(records));

console.log(`\n  rust pre-serialized vs typescript JSON.parse + filter: ${(tsText / pre).toFixed(2)}x`);
console.log(`  rust pre-serialized vs typescript: ${(ts / pre).toFixed(2)}x`);
console.log(`  rust incl. stringify vs typescript: ${(ts / full).toFixed(2)}x`);

console.log('\nper-record call across the boundary');
const sample = records[1];
const sampleJson = JSON.stringify(sample);
measure('typescript predicate(record)', 200_000, () => reference(sample));
measure('rust test(recordJson)', 200_000, () => native.test(sampleJson));
measure('rust test(record) incl. stringify', 200_000, () => compiled.test(sample));
