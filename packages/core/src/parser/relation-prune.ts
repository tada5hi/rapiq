/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../errors';
import {
    Field,
    Fields,
    Filter,
    Filters,
    Relation,
    Relations,
    Sort,
    Sorts,
    isCondition,
    isFilter,
    isFilters,
} from '../parameter';
import type {
    ICondition,
    IFields,
    IFilters,
    IRelations,
    ISorts,
} from '../parameter';
import { FilterCompoundOperator, FilterFieldOperator } from '../schema';
import type { FiltersSchema, SortSchema } from '../schema';
import { parseKey } from '../utils';
import { buildFiltersDefaults } from './parameter/filters/validate';

/**
 * The rejected relation governing a canonical relation/field path: the path
 * is the relation itself or lives underneath it.
 */
function matchRelationRejected(path: string, rejected: string[]) : string | undefined {
    return rejected.find(
        (name) => path === name || path.startsWith(`${name}.`),
    );
}

/**
 * Whether a canonical relation/field path is governed by a rejected relation —
 * the path is the relation itself or lives underneath it.
 */
export function isRelationRejected(path: string, rejected: string[]) : boolean {
    return typeof matchRelationRejected(path, rejected) !== 'undefined';
}

function joinPath(prefix: string, segment: string) : string {
    return prefix ? `${prefix}.${segment}` : segment;
}

/**
 * Drop every field whose canonical name traverses a rejected relation.
 */
export function pruneFieldsByRelations(fields: IFields, rejected: string[]) : IFields {
    if (rejected.length === 0) {
        return fields;
    }

    return new Fields(
        fields.value
            .filter((field) => !isRelationRejected(field.name, rejected))
            // the visibility condition must survive the rebuild: dropping it
            // would turn a gated field into an ungated one.
            .map((field) => new Field(field.name, field.operator, field.condition)),
    );
}

/**
 * Drop every sort whose canonical name traverses a rejected relation. Falls back
 * to the schema `default` when pruning empties the parameter — mirroring the
 * parser, which re-applies defaults once relation gating removes every key.
 */
export function pruneSortsByRelations(
    sorts: ISorts,
    rejected: string[],
    schema?: SortSchema,
) : ISorts {
    if (rejected.length === 0) {
        return sorts;
    }

    const value = sorts.value
        .filter((sort) => !isRelationRejected(sort.name, rejected))
        .map((sort) => new Sort(sort.name, sort.operator));

    if (value.length === 0 && schema) {
        return buildSortDefaults(schema);
    }

    return new Sorts(value);
}

/**
 * Drop every relation at or below a rejected relation.
 */
export function pruneRelationsByRelations(relations: IRelations, rejected: string[]) : IRelations {
    if (rejected.length === 0) {
        return relations;
    }

    return new Relations(
        relations.value
            .filter((relation) => !isRelationRejected(relation.name, rejected))
            .map((relation) => new Relation(relation.name)),
    );
}

/**
 * Prune a filter tree of every leaf traversing a rejected relation, collapsing
 * empty compounds (mirrors {@link applyFiltersSchemaValidation}). Interior
 * `elemMatch` conditions are addressed relative to the array element, so a
 * running `prefix` reconstructs their absolute path before matching. Falls back
 * to the schema `default` when pruning empties the parameter.
 *
 * A preserved condition is exempt from the drop, not from the gate: pruning
 * anything out of a preserved subtree returns a query the preserved condition
 * does not describe (wider under the `and(<leaf>, <scope>)` shape a filters
 * validator produces, narrower under an `or`), while keeping it would join a
 * relation the relations validator rejected. Neither outcome is correct, so the
 * contradiction between the two validators throws {@link SchemaError}
 * (`SCHEMA_PRESERVED_CONDITION_PRUNED`) instead of resolving it silently. The
 * decision is per node, not per operator: preservation says the condition
 * survives composition intact, and pruning is not asked to reason about which shapes
 * happen to fail open.
 */
export function pruneFiltersByRelations(
    filters: IFilters,
    rejected: string[],
    schema?: FiltersSchema,
) : IFilters {
    if (rejected.length === 0) {
        return filters;
    }

    const pruned = pruneCondition(filters, rejected, '', false);
    if (pruned && isFilters(pruned)) {
        return pruned;
    }

    let conditions : ICondition[];
    if (pruned) {
        conditions = [pruned];
    } else {
        conditions = schema ? buildFiltersDefaults(schema) : [];

        // The default is the server's own baseline and is exempt from the gate:
        // it is re-applied here un-pruned, even when it names a rejected
        // relation. A preserved default asserts the same must-survive contract as
        // a validator residual though, so it is checked: without this, the very
        // same default would throw or survive depending on whether the client
        // sent a filter of its own, which is what decides whether it was
        // materialized before this pass or after it.
        for (const condition of conditions) {
            assertPreservedSurvivesPruning(condition, rejected);
        }
    }

    return new Filters(FilterCompoundOperator.AND, conditions);
}

/**
 * Raise the preserved-condition contradiction for a condition that is kept rather
 * than pruned. The pruned copy is discarded: only the throw matters here.
 */
function assertPreservedSurvivesPruning(condition: ICondition, rejected: string[]) : void {
    pruneCondition(condition, rejected, '', false);
}

/**
 * Drop the condition at `field`, unless it is protected: a drop inside a preserved
 * subtree is the one case pruning must refuse rather than resolve.
 */
function dropUnlessPreserved(relation: string, field: string, preserved: boolean) : undefined {
    if (preserved) {
        throw SchemaError.preservedConditionPruned(relation, field);
    }

    return undefined;
}

function pruneCondition(
    node: ICondition,
    rejected: string[],
    prefix: string,
    preserved: boolean,
) : ICondition | undefined {
    // The marker protects the whole subtree it heads. Custom conditions cannot
    // carry it directly and are protected through preserve()'s built-in wrapper.
    const preserved2 = preserved || isBuiltInConditionPreserved(node);

    if (isFilter(node)) {
        const field = joinPath(prefix, node.field);
        const rejectedBy = matchRelationRejected(field, rejected);

        if (
            node.operator === FilterFieldOperator.ELEM_MATCH &&
            isCondition(node.value)
        ) {
            if (typeof rejectedBy === 'string') {
                return dropUnlessPreserved(
                    rejectedBy,
                    field,
                    preserved2 || hasPreservedBuiltInCondition(node.value),
                );
            }

            const interior = pruneCondition(node.value, rejected, field, preserved2);
            if (!interior) {
                return undefined;
            }

            if (interior !== node.value) {
                return new Filter(node.operator, node.field, interior, { preserved: node.preserved });
            }

            return node;
        }

        return typeof rejectedBy === 'string' ?
            dropUnlessPreserved(rejectedBy, field, preserved2) :
            node;
    }

    if (!isFilters(node)) {
        return node;
    }

    const conditions : ICondition[] = [];
    for (const child of node.value) {
        const child2 = pruneCondition(child, rejected, prefix, preserved2);
        if (child2) {
            conditions.push(child2);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(node.operator, conditions, { preserved: node.preserved });
}

function isBuiltInConditionPreserved(node: ICondition) : boolean {
    if (isFilter(node) || isFilters(node)) {
        return node.preserved === true;
    }

    return false;
}

function hasPreservedBuiltInCondition(node: ICondition) : boolean {
    if (isBuiltInConditionPreserved(node)) {
        return true;
    }

    if (isFilters(node)) {
        return node.value.some((child) => hasPreservedBuiltInCondition(child));
    }

    if (
        isFilter(node) &&
        node.operator === FilterFieldOperator.ELEM_MATCH &&
        isCondition(node.value)
    ) {
        return hasPreservedBuiltInCondition(node.value);
    }

    return false;
}

function buildSortDefaults(schema: SortSchema) : Sorts {
    const output = new Sorts();
    if (!schema.default) {
        return output;
    }

    for (const key of Object.keys(schema.default)) {
        const details = parseKey(key);
        const name = details.path ? `${details.path}.${details.name}` : details.name;
        output.value.push(new Sort(name, schema.default[key]));
    }

    return output;
}
