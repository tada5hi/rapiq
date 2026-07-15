/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filters,
    isFilter,
    isFilters,
} from '../../../parameter';
import type {
    ICondition,
    IFilter,
    IFilters,
} from '../../../parameter';
import type { FiltersSchema } from '../../../schema';
import { SchemaError } from '../../../errors';

function isPromiseLike(input: unknown) : input is PromiseLike<unknown> {
    return (
        input !== null &&
        (typeof input === 'object' || typeof input === 'function') &&
        'then' in input &&
        typeof input.then === 'function'
    );
}

/**
 * Apply a filter schema's leaf validator without flattening or otherwise
 * changing the compound tree. Returning `undefined` from the validator drops
 * only that leaf; replacement filters are inserted in the same position.
 */
export function applyFiltersSchemaValidation(
    input: IFilter | IFilters,
    schema: FiltersSchema,
) : IFilter | IFilters | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
) : ICondition | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
) : ICondition | undefined {
    if (isFilter(input)) {
        const output = schema.validate(input);
        if (isPromiseLike(output)) {
            void Promise.resolve(output).catch(() => undefined);
            throw SchemaError.validatorAsyncRequiresAsyncParser();
        }

        return output || undefined;
    }

    if (!isFilters(input)) {
        return input;
    }

    const conditions : ICondition[] = [];
    for (const child of input.value) {
        const validated = applyFiltersSchemaValidation(child, schema);
        if (validated) {
            conditions.push(validated);
        }
    }

    return new Filters(input.operator, conditions);
}

/**
 * Async counterpart of {@link applyFiltersSchemaValidation}. Validators are
 * awaited sequentially so leaf order and observable execution order remain
 * identical to the synchronous traversal.
 */
export function applyFiltersSchemaValidationAsync(
    input: IFilter | IFilters,
    schema: FiltersSchema,
) : Promise<IFilter | IFilters | undefined>;
export function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
) : Promise<ICondition | undefined>;
export async function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
) : Promise<ICondition | undefined> {
    if (isFilter(input)) {
        return (await schema.validate(input)) || undefined;
    }

    if (!isFilters(input)) {
        return input;
    }

    const conditions : ICondition[] = [];
    for (const child of input.value) {
        const validated = await applyFiltersSchemaValidationAsync(child, schema);
        if (validated) {
            conditions.push(validated);
        }
    }

    return new Filters(input.operator, conditions);
}
