/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    Filters,
    isFilter,
    isFilters,
} from '../../../parameter';
import type {
    ICondition,
    IFilter,
    IFilters,
} from '../../../parameter';
import { FilterFieldOperator } from '../../../schema';
import type { FiltersSchema } from '../../../schema';
import { SchemaError } from '../../../errors';

/**
 * The conditions a parser falls back to when the input carries no
 * (surviving) filters — the schema `default`, or nothing.
 */
export function buildFiltersDefaults(schema: FiltersSchema) : ICondition[] {
    if (!schema.default) {
        return [];
    }

    if (Array.isArray(schema.default)) {
        return schema.default;
    }

    return [schema.default];
}

function isPromiseLike(input: unknown) : input is PromiseLike<unknown> {
    return (
        input !== null &&
        (typeof input === 'object' || typeof input === 'function') &&
        'then' in input &&
        typeof input.then === 'function'
    );
}

function isConditionValue(input: unknown) : input is ICondition {
    // isFilters guards structurally at runtime; the parameter type is
    // merely narrower than this call site.
    return isFilter(input) || isFilters(input as ICondition);
}

/**
 * Apply a filter schema's leaf validator without flattening or otherwise
 * changing the compound tree. Returning `undefined` from the validator drops
 * only that leaf; replacement filters are inserted in the same position.
 * A compound whose every child is rejected is dropped entirely (`undefined`),
 * so callers fall back to the schema defaults instead of keeping a vacuous
 * node. An `elemMatch` leaf is validated inside-out: the interior condition
 * tree first (dropping the whole leaf when nothing survives), then the
 * rebuilt leaf itself.
 */
export function applyFiltersSchemaValidation(
    input: IFilter | IFilters,
    schema: FiltersSchema,
    context?: unknown,
) : IFilter | IFilters | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
) : ICondition | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
) : ICondition | undefined {
    if (!schema.hasValidator()) {
        return input;
    }

    if (isFilter(input)) {
        let leaf = input;
        if (
            input.operator === FilterFieldOperator.ELEM_MATCH &&
            isConditionValue(input.value)
        ) {
            const interior = applyFiltersSchemaValidation(input.value, schema, context);
            if (!interior) {
                return undefined;
            }

            if (interior !== input.value) {
                leaf = new Filter(input.operator, input.field, interior);
            }
        }

        const output = schema.validate(leaf, context);
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
        const validated = applyFiltersSchemaValidation(child, schema, context);
        if (validated) {
            conditions.push(validated);
        }
    }

    if (conditions.length === 0) {
        return undefined;
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
    context?: unknown,
) : Promise<IFilter | IFilters | undefined>;
export function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
) : Promise<ICondition | undefined>;
export async function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
) : Promise<ICondition | undefined> {
    if (!schema.hasValidator()) {
        return input;
    }

    if (isFilter(input)) {
        let leaf = input;
        if (
            input.operator === FilterFieldOperator.ELEM_MATCH &&
            isConditionValue(input.value)
        ) {
            const interior = await applyFiltersSchemaValidationAsync(input.value, schema, context);
            if (!interior) {
                return undefined;
            }

            if (interior !== input.value) {
                leaf = new Filter(input.operator, input.field, interior);
            }
        }

        return (await schema.validate(leaf, context)) || undefined;
    }

    if (!isFilters(input)) {
        return input;
    }

    const conditions : ICondition[] = [];
    for (const child of input.value) {
        const validated = await applyFiltersSchemaValidationAsync(child, schema, context);
        if (validated) {
            conditions.push(validated);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(input.operator, conditions);
}
