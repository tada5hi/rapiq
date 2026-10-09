/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ConditionIR =
    | { type: 'filter', operator: string, field: string, value: unknown } |
    { type: 'filters', operator: string, value: ConditionIR[] };

export type EvaluateOptions = {
    caseSensitive?: boolean | string[],
};

export type CompiledFilters = {
    test(record: unknown): boolean,
    filter<T>(records: T[]): T[],
};

export declare const binding: {
    parseExpressionFilters(input?: string): string,
    parseExpressionFiltersExact(input: string): string,
    matches(filters: string, record: string, options?: string): boolean,
    Predicate: new (filters: string, options?: string) => {
        test(record: string): boolean,
        filterIndices(records: string): number[],
    },
};

export declare function parseExpressionFilters(input?: string | null): ConditionIR;

export declare function parseExpressionFiltersExact(input: string): ConditionIR;

export declare function matches(
    filters: ConditionIR,
    record: unknown,
    options?: EvaluateOptions,
): boolean;

export declare function compileFilters(
    filters: ConditionIR,
    options?: EvaluateOptions,
): CompiledFilters;
