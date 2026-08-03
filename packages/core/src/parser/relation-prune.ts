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

function isConditionValue(input: unknown) : input is ICondition {
    return isFilter(input as ICondition) || isFilters(input as ICondition);
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
 * A sealed condition is exempt from the drop, not from the gate: pruning
 * anything out of a sealed subtree would widen a condition whose seal says it
 * must survive, while keeping it would join a relation the relations validator
 * rejected. Neither outcome is correct, so the contradiction between the two
 * validators throws {@link SchemaError} (`SCHEMA_SEALED_CONDITION_PRUNED`)
 * instead of failing open.
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
    }

    return new Filters(FilterCompoundOperator.AND, conditions);
}

/**
 * Drop the condition at `field`, or refuse to when it is protected: a drop
 * inside a sealed subtree is the one case where pruning would silently widen
 * the query rather than narrow it.
 */
function drop(relation: string, field: string, sealed: boolean) : undefined {
    if (sealed) {
        throw SchemaError.sealedConditionPruned(relation, field);
    }

    return undefined;
}

function pruneCondition(
    node: ICondition,
    rejected: string[],
    prefix: string,
    sealed: boolean,
) : ICondition | undefined {
    // the marker protects the whole subtree it heads: every condition below a
    // seal is part of what the seal says must survive.
    const sealed2 = sealed || !!node.sealed;

    if (isFilter(node)) {
        const field = joinPath(prefix, node.field);
        const rejectedBy = matchRelationRejected(field, rejected);

        if (
            node.operator === FilterFieldOperator.ELEM_MATCH &&
            isConditionValue(node.value)
        ) {
            if (typeof rejectedBy === 'string') {
                return drop(rejectedBy, field, sealed2);
            }

            const interior = pruneCondition(node.value, rejected, field, sealed2);
            if (!interior) {
                return undefined;
            }

            if (interior !== node.value) {
                return new Filter(node.operator, node.field, interior, { sealed: node.sealed });
            }

            return node;
        }

        return typeof rejectedBy === 'string' ?
            drop(rejectedBy, field, sealed2) :
            node;
    }

    if (!isFilters(node)) {
        return node;
    }

    const conditions : ICondition[] = [];
    for (const child of node.value) {
        const child2 = pruneCondition(child, rejected, prefix, sealed2);
        if (child2) {
            conditions.push(child2);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(node.operator, conditions, { sealed: node.sealed });
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
