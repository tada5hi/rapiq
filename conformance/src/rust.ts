/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createRequire } from 'node:module';
import type { ConditionIR } from '@rapiq/core';

type Options = { caseSensitive?: boolean | string[] };

type Binding = {
    parseExpressionFilters(input?: string | null) : string,
    parseExpressionFiltersExact(input: string) : string,
    planCondition(condition: string, options?: string | null) : string,
    distributeNegation(plan: string) : string,
    operatorSemantics() : string,
    Predicate: new (filters: string, options?: string | null) => {
        test(record: string) : boolean,
        filterIndices(records: string) : number[],
    },
};

/**
 * The raw napi binding of @rapiq/core (JSON strings in and out), loaded
 * through the loader napi-rs generates. Build it first:
 * `npm run build:binding --workspace=packages/core/node`.
 */
export const binding = createRequire(import.meta.url)('../../packages/core/node/binding/index.cjs') as Binding;

function stringifyOptions(options?: Options) : string | undefined {
    return options ? JSON.stringify(options) : undefined;
}

export function parseExpressionFilters(input?: string | null) : ConditionIR {
    return JSON.parse(binding.parseExpressionFilters(input ?? undefined));
}

export function parseExpressionFiltersExact(input: string) : ConditionIR {
    return JSON.parse(binding.parseExpressionFiltersExact(input));
}

export function compileFilters(filters: unknown, options?: Options) {
    const predicate = new binding.Predicate(JSON.stringify(filters), stringifyOptions(options));

    return {
        test: (record: unknown) => predicate.test(JSON.stringify(record)),
        filter: <T>(records: T[]) : T[] => predicate
            .filterIndices(JSON.stringify(records))
            .map((index) => records[index] as T),
    };
}
