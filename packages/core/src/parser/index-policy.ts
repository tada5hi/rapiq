/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import { Filters } from '../parameter';
import type { IFilters, ISorts } from '../parameter';
import {
    FilterCompoundOperator,
    ResolutionScope,
    checkConditionIndexed,
    checkSortKeysIndexed,
} from '../schema';
import type {
    FiltersSchema,
    IndexesResolver,
    Schema,
    SchemaRegistry,
    SortSchema,
} from '../schema';
import type { ObjectLiteral } from '../types';
import { FiltersParseError } from './parameter/filters/error';
import { SortParseError } from './parameter/sort/error';
import { buildFiltersDefaults } from './parameter/filters/validate';
import { buildSortDefaults } from './relation-prune';

type IndexPolicyContext = {
    throwOnFailure?: boolean,
};

/**
 * Indexes are read from the schema governing each relation path, so a
 * dotted leaf checks the target schema's declaration. The scope walk
 * mirrors allow-list resolution (registry + schemaMapping), without
 * relation gating: the tree only carries already-resolved paths.
 */
function indexesResolverFor(scope: ResolutionScope<any, any>) : IndexesResolver {
    const cache = new Map<string, string[][] | null>();

    return (path) => {
        const cached = cache.get(path);
        if (typeof cached !== 'undefined') {
            return cached;
        }

        let target = scope;
        if (path !== '') {
            const child = scope.descend(path);
            if (!(child instanceof ResolutionScope)) {
                cache.set(path, null);
                return null;
            }

            target = child;
        }

        const schema = target.schema as { indexes: string[][], indexesIsUndefined: boolean };
        const value = schema.indexesIsUndefined ? null : schema.indexes;
        cache.set(path, value);

        return value;
    };
}

function isFiltersDefaults(output: IFilters, schema: FiltersSchema) : boolean {
    const defaults = buildFiltersDefaults(schema);
    if (defaults.length === 0 || output.value.length !== defaults.length) {
        return false;
    }

    return output.value.every((item, index) => item === defaults[index]);
}

function isSortDefaults(output: ISorts, schema: SortSchema) : boolean {
    const defaults = buildSortDefaults(schema);
    if (
        defaults.value.length === 0 ||
        output.value.length !== defaults.value.length
    ) {
        return false;
    }

    return output.value.every((sort, index) => {
        const other = defaults.value[index];

        return typeof other !== 'undefined' &&
            sort.name === other.name &&
            sort.operator === other.operator;
    });
}

/**
 * Enforce the schema's `indexed` filters policy on a final parsed tree.
 * Runs after validate hooks and relation pruning, so server-authored
 * residuals legitimately anchor the executed query; the schema default
 * tree is server-authored and bypasses. Violations follow the standard
 * failure policy: drop the parameter whole (falling back to the
 * default), or throw typed under `throwOnFailure`.
 */
export function applyFiltersIndexPolicy<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    output: IFilters,
    registry: SchemaRegistry,
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>,
    context: IndexPolicyContext = {},
) : IFilters {
    const scope = ResolutionScope.for(registry, Parameter.FILTERS, schema, { throwOnFailure: context.throwOnFailure });

    const filtersSchema = scope.schema as FiltersSchema<RECORD>;
    if (!filtersSchema.indexed || isFiltersDefaults(output, filtersSchema)) {
        return output;
    }

    const result = checkConditionIndexed(
        output,
        indexesResolverFor(scope),
        filtersSchema.indexed,
    );
    if (result.ok) {
        return output;
    }

    if (scope.throwOnFailure) {
        throw FiltersParseError.keyCombinationNotIndexed(result.keys);
    }

    return new Filters(FilterCompoundOperator.AND, buildFiltersDefaults(filtersSchema));
}

/**
 * Sort counterpart of {@link applyFiltersIndexPolicy}: ordered
 * leftmost-prefix rule, defaults bypass, standard failure policy.
 */
export function applySortIndexPolicy<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    output: ISorts,
    registry: SchemaRegistry,
    schema?: string | Schema<RECORD> | SortSchema<RECORD>,
    context: IndexPolicyContext = {},
) : ISorts {
    const scope = ResolutionScope.for(registry, Parameter.SORT, schema, { throwOnFailure: context.throwOnFailure });

    const sortSchema = scope.schema as SortSchema<RECORD>;
    if (
        !sortSchema.indexed ||
        output.value.length === 0 ||
        isSortDefaults(output, sortSchema)
    ) {
        return output;
    }

    const result = checkSortKeysIndexed(
        output.value.map((sort) => sort.name),
        indexesResolverFor(scope),
    );
    if (result.ok) {
        return output;
    }

    if (scope.throwOnFailure) {
        throw SortParseError.keyCombinationNotIndexed(result.keys);
    }

    return buildSortDefaults(sortSchema);
}
