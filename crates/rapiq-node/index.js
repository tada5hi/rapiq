/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * The raw napi binding: JSON strings in and out. A failure is an Error
 * whose `code` is the rapiq ErrorCode value.
 */
export const binding = require('./rapiq.node');

function stringifyOptions(options) {
    return options ? JSON.stringify(options) : undefined;
}

export function parseExpressionFilters(input) {
    return JSON.parse(binding.parseExpressionFilters(input ?? undefined));
}

export function parseExpressionFiltersExact(input) {
    return JSON.parse(binding.parseExpressionFiltersExact(input));
}

export function matches(filters, record, options) {
    return binding.matches(
        JSON.stringify(filters),
        JSON.stringify(record),
        stringifyOptions(options),
    );
}

export function compileFilters(filters, options) {
    const predicate = new binding.Predicate(
        JSON.stringify(filters),
        stringifyOptions(options),
    );

    return {
        test: (record) => predicate.test(JSON.stringify(record)),
        filter: (records) => JSON.parse(predicate.filter(JSON.stringify(records))),
    };
}
