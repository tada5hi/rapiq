/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { flattenIssueItems } from '@ebec/core';
import { Parameter } from '../constants';
import {
    Filters,
    isCondition,
    isFilter,
    isFilters,
} from '../parameter';
import type { ICondition, IFilters, ISorts } from '../parameter';
import {
    ErrorCode,
    ErrorMessage,
    SchemaError,
    extractIssueParameter,
} from '../errors';
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
    SortsSchema,
} from '../schema';
import type { ObjectLiteral } from '../types';
import { parseKey } from '../utils';
import type { IIssueCollector } from './issue';
import { FiltersParseError } from './parameter/filters/error';
import { SortsParseError } from './parameter/sort/error';
import { buildFiltersDefaults } from './parameter/filters/validate';
import { buildSortsDefaults } from './relation-prune';

type IndexPolicyContext = {
    throwOnFailure?: boolean,
    /**
     * Trace of the enclosing parse. Present: the violation is recorded and
     * the parse continues to its own end. Absent: it throws here.
     */
    issueCollector?: IIssueCollector,
};

function hasIssueForParameter(
    collector: IIssueCollector | undefined,
    parameter: `${Parameter}`,
) : boolean {
    return collector ? flattenIssueItems(collector.issues)
        .some((issue) => extractIssueParameter(issue) === parameter) : false;
}

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

/**
 * Semantic equality of two condition trees: field, operator and value,
 * flags excluded (a codec round trip rebuilds fresh instances and never
 * carries preservation). Unknown condition kinds compare by identity.
 */
function conditionEquals(a: ICondition, b: ICondition) : boolean {
    if (a === b) {
        return true;
    }

    if (isFilter(a) && isFilter(b)) {
        return a.operator === b.operator &&
            a.field === b.field &&
            filterValueEquals(a.value, b.value);
    }

    if (isFilters(a) && isFilters(b)) {
        return a.operator === b.operator &&
            a.value.length === b.value.length &&
            a.value.every(
                (child, index) => conditionEquals(child, b.value[index] as ICondition),
            );
    }

    return false;
}

function filterValueEquals(a: unknown, b: unknown) : boolean {
    if (isCondition(a) && isCondition(b)) {
        return conditionEquals(a, b);
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length &&
            a.every((element, index) => element === b[index]);
    }

    return a === b;
}

/**
 * A preserved condition anywhere in the tree, including elemMatch
 * interiors. Custom kinds enter preservation through the preserve()
 * wrapper, a flagged Filters node, so flag checks on the built-in
 * nodes cover them.
 */
function hasPreservedCondition(node: ICondition) : boolean {
    if (isFilter(node)) {
        if (node.preserved) {
            return true;
        }

        return isCondition(node.value) ? hasPreservedCondition(node.value) : false;
    }

    if (isFilters(node)) {
        if (node.preserved) {
            return true;
        }

        return node.value.some(hasPreservedCondition);
    }

    return false;
}

function isFiltersDefaults(output: IFilters, schema: FiltersSchema) : boolean {
    const defaults = buildFiltersDefaults(schema);
    if (defaults.length === 0 || output.value.length !== defaults.length) {
        return false;
    }

    return output.value.every((item, index) => {
        const other = defaults[index];

        return typeof other !== 'undefined' && conditionEquals(item, other);
    });
}

/**
 * The client-authored subset of a sort list. Server-authored default
 * entries are exempt from the index check: the root schema's defaults
 * (declared under their full, possibly dotted name), and the
 * per-relation defaults a child schema contributes when a client's
 * relation sort keys all drop. An entry counts as a default when the
 * schema governing its path declares exactly that name and direction.
 */
function collectClientSortKeys(
    output: ISorts,
    scope: ResolutionScope<any, any>,
) : string[] {
    const rootSchema = scope.schema as SortsSchema;
    const rootDefaults = rootSchema.defaultIsUndefined ? null : rootSchema.default;

    const cache = new Map<string, Record<string, string> | null>();
    const names : string[] = [];

    for (const sort of output.value) {
        if (rootDefaults && rootDefaults[sort.name] === sort.operator) {
            continue;
        }

        const details = parseKey(sort.name);
        const path = details.path ?? '';

        let defaults = cache.get(path);
        if (typeof defaults === 'undefined') {
            defaults = null;

            if (path !== '') {
                const child = scope.descend(path);
                if (child instanceof ResolutionScope) {
                    const childSchema = child.schema as SortsSchema;
                    if (!childSchema.defaultIsUndefined) {
                        defaults = childSchema.default;
                    }
                }
            }

            cache.set(path, defaults);
        }

        if (defaults && defaults[details.name] === sort.operator) {
            continue;
        }

        names.push(sort.name);
    }

    return names;
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
    if (
        !filtersSchema.indexed ||
        isFiltersDefaults(output, filtersSchema) ||
        // A filter failure already explains why this tree cannot execute.
        // Its index violation is only a consequence (and its preserved-
        // condition refusal would displace that original failure).
        hasIssueForParameter(context.issueCollector, Parameter.FILTERS)
    ) {
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

    // A preserved (must-survive) condition cannot be dropped with the
    // tree: mirror relation pruning and refuse loudly.
    if (!scope.throwOnFailure && hasPreservedCondition(output)) {
        throw SchemaError.preservedConditionNotIndexed(result.keys);
    }

    const defaults = scope.throwOnFailure ? [] : buildFiltersDefaults(filtersSchema);

    // Dropping to an empty filter set would execute an unfiltered scan, the
    // exact outcome the policy exists to prevent: with no fallback to fall
    // back to, the violation always fails the parse.
    const fatal = scope.throwOnFailure || defaults.length === 0;

    if (context.issueCollector) {
        if (fatal) {
            context.issueCollector.add({
                code: ErrorCode.KEY_COMBINATION_NOT_INDEXED,
                parameter: Parameter.FILTERS,
                path: [],
                received: result.keys,
                message: ErrorMessage.keyCombinationNotIndexed(result.keys),
            });

            // the parse ends on the recorded issue; the tree it ends with is
            // never observed.
            return output;
        }

        return new Filters(FilterCompoundOperator.AND, defaults);
    }

    if (fatal) {
        throw FiltersParseError.keyCombinationNotIndexed(result.keys);
    }

    return new Filters(FilterCompoundOperator.AND, defaults);
}

/**
 * Sorts counterpart of {@link applyFiltersIndexPolicy}: ordered
 * leftmost-prefix rule applied to the client-authored keys only
 * (server-authored default entries, root or relation-scoped, are
 * exempt), standard failure policy.
 */
export function applySortsIndexPolicy<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    output: ISorts,
    registry: SchemaRegistry,
    schema?: string | Schema<RECORD> | SortsSchema<RECORD>,
    context: IndexPolicyContext = {},
) : ISorts {
    const scope = ResolutionScope.for(registry, Parameter.SORTS, schema, { throwOnFailure: context.throwOnFailure });

    const sortSchema = scope.schema as SortsSchema<RECORD>;
    if (
        !sortSchema.indexed ||
        output.value.length === 0 ||
        // A sort failure already explains why this list cannot execute; its
        // index violation is only a consequence of that original failure.
        hasIssueForParameter(context.issueCollector, Parameter.SORTS)
    ) {
        return output;
    }

    const names = collectClientSortKeys(output, scope);
    if (names.length === 0) {
        return output;
    }

    const result = checkSortKeysIndexed(names, indexesResolverFor(scope));
    if (result.ok) {
        return output;
    }

    if (context.issueCollector) {
        if (!scope.throwOnFailure) {
            return buildSortsDefaults(sortSchema);
        }

        context.issueCollector.add({
            code: ErrorCode.KEY_COMBINATION_NOT_INDEXED,
            parameter: Parameter.SORTS,
            path: [],
            received: result.keys,
            message: ErrorMessage.keyCombinationNotIndexed(result.keys),
        });

        return output;
    }

    if (scope.throwOnFailure) {
        throw SortsParseError.keyCombinationNotIndexed(result.keys);
    }

    return buildSortsDefaults(sortSchema);
}

/**
 * @deprecated use {@link applySortsIndexPolicy}. Removed in 3.0.
 */
export const applySortIndexPolicy = applySortsIndexPolicy;
