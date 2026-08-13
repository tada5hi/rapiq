/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    Filters,
    isCondition,
    isFilter,
    isFilters,
    preserve,
} from '../../../parameter';
import type {
    ICondition,
    IFilter,
    IFilters,
} from '../../../parameter';
import { FilterFieldOperator } from '../../../schema';
import type { FiltersSchema } from '../../../schema';
import { toIssuePath } from '../../../utils';
import { Parameter } from '../../../constants';
import { ErrorCode, ErrorMessage, SchemaError } from '../../../errors';
import type { IIssueCollector } from '../../issue';
import { FiltersParseError } from './error';

export type FiltersValidationOptions = {
    /**
     * Trace of the enclosing parse.
     */
    issueCollector?: IIssueCollector,
    /**
     * Call-time failure-policy override, taking precedence over the filters
     * sub-schema's own setting exactly like everywhere else
     * (`throwOnFailure ?? schema.throwOnFailure ?? false`). Without it a leaf
     * rejection would be the one violation a call-time override cannot
     * govern.
     *
     * Deliberately NOT the resolving scope's effective policy: the expression
     * dialect forces its scope to throw because an expression cannot be
     * partially reinterpreted, and that says nothing about whether a policy
     * hook declining a leaf should fail the request.
     */
    throwOnFailure?: boolean,
};

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

/**
 * A leaf the schema validator declined.
 *
 * The hook is the filters counterpart of the fields/sorts/relations key
 * validators, so it fails the same way: an issue always, and
 * `KEY_VALIDATE_REJECTED` under `throwOnFailure`. A hook that means to drop a
 * leaf silently under a throwing schema returns a replacement condition
 * instead of `undefined`.
 */
function rejectLeaf(
    leaf: IFilter<string, unknown>,
    schema: FiltersSchema,
    options: FiltersValidationOptions,
) : void {
    const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure ?? false;

    if (options.issueCollector) {
        options.issueCollector.violation({
            code: ErrorCode.KEY_VALIDATE_REJECTED,
            parameter: Parameter.FILTERS,
            path: toIssuePath(leaf.field),
            message: ErrorMessage.keyValidateRejected(leaf.field),
        }, throwOnFailure, FiltersParseError);

        return;
    }

    if (throwOnFailure) {
        throw FiltersParseError.keyValidateRejected(leaf.field);
    }
}

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
 * only that leaf; replacement conditions (a leaf or a whole compound, e.g.
 * `and(<leaf>, <policy residual>)`) are inserted in the same position.
 * A compound whose every child is rejected is dropped entirely (`undefined`),
 * so callers fall back to the schema defaults instead of keeping a vacuous
 * node. An `elemMatch` leaf is validated inside-out: the interior condition
 * tree first (dropping the whole leaf when nothing survives), then the
 * rebuilt leaf itself.
 */
export function applyFiltersSchemaValidation(
    input: IFilters,
    schema: FiltersSchema,
    context?: unknown,
    options?: FiltersValidationOptions,
) : IFilters | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
    options?: FiltersValidationOptions,
) : ICondition | undefined;
export function applyFiltersSchemaValidation(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
    options: FiltersValidationOptions = {},
) : ICondition | undefined {
    if (!schema.hasValidator()) {
        return input;
    }

    if (isFilter(input)) {
        let leaf = input;
        if (
            input.operator === FilterFieldOperator.ELEM_MATCH &&
            isCondition(input.value)
        ) {
            const interior = applyFiltersSchemaValidation(input.value, schema, context, options);
            if (!interior) {
                return undefined;
            }

            if (interior !== input.value) {
                leaf = new Filter(input.operator, input.field, interior, { preserved: input.preserved });
            }
        }

        const output = schema.validate(leaf, context);
        if (isPromiseLike(output)) {
            void Promise.resolve(output).catch(() => undefined);
            throw SchemaError.validatorAsyncRequiresAsyncParser();
        }

        if (!output) {
            rejectLeaf(leaf, schema, options);

            return undefined;
        }

        // The replacement stands in for the leaf, so it inherits
        // relation-pruning preservation.
        return leaf.preserved ? preserve(output) : output;
    }

    if (!isFilters(input)) {
        return input;
    }

    const conditions : ICondition[] = [];
    for (const child of input.value) {
        const validated = applyFiltersSchemaValidation(child, schema, context, options);
        if (validated) {
            conditions.push(validated);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(input.operator, conditions, { preserved: input.preserved });
}

/**
 * Async counterpart of {@link applyFiltersSchemaValidation}. Validators are
 * awaited sequentially so leaf order and observable execution order remain
 * identical to the synchronous traversal.
 */
export function applyFiltersSchemaValidationAsync(
    input: IFilters,
    schema: FiltersSchema,
    context?: unknown,
    options?: FiltersValidationOptions,
) : Promise<IFilters | undefined>;
export function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
    options?: FiltersValidationOptions,
) : Promise<ICondition | undefined>;
export async function applyFiltersSchemaValidationAsync(
    input: ICondition,
    schema: FiltersSchema,
    context?: unknown,
    options: FiltersValidationOptions = {},
) : Promise<ICondition | undefined> {
    if (!schema.hasValidator()) {
        return input;
    }

    if (isFilter(input)) {
        let leaf = input;
        if (
            input.operator === FilterFieldOperator.ELEM_MATCH &&
            isCondition(input.value)
        ) {
            const interior = await applyFiltersSchemaValidationAsync(input.value, schema, context, options);
            if (!interior) {
                return undefined;
            }

            if (interior !== input.value) {
                leaf = new Filter(input.operator, input.field, interior, { preserved: input.preserved });
            }
        }

        const output = await schema.validate(leaf, context);
        if (!output) {
            rejectLeaf(leaf, schema, options);

            return undefined;
        }

        return leaf.preserved ? preserve(output) : output;
    }

    if (!isFilters(input)) {
        return input;
    }

    const conditions : ICondition[] = [];
    for (const child of input.value) {
        const validated = await applyFiltersSchemaValidationAsync(child, schema, context, options);
        if (validated) {
            conditions.push(validated);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(input.operator, conditions, { preserved: input.preserved });
}
