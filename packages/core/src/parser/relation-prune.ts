/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
 * Whether a canonical relation/field path is governed by a rejected relation —
 * the path is the relation itself or lives underneath it.
 */
export function isRelationRejected(path: string, rejected: string[]) : boolean {
    return rejected.some(
        (name) => path === name || path.startsWith(`${name}.`),
    );
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
            .map((field) => new Field(field.name, field.operator)),
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
 */
export function pruneFiltersByRelations(
    filters: IFilters,
    rejected: string[],
    schema?: FiltersSchema,
) : IFilters {
    if (rejected.length === 0) {
        return filters;
    }

    const pruned = pruneCondition(filters, rejected, '');
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

function pruneCondition(
    node: ICondition,
    rejected: string[],
    prefix: string,
) : ICondition | undefined {
    if (isFilter(node)) {
        const field = joinPath(prefix, node.field);

        if (
            node.operator === FilterFieldOperator.ELEM_MATCH &&
            isConditionValue(node.value)
        ) {
            if (isRelationRejected(field, rejected)) {
                return undefined;
            }

            const interior = pruneCondition(node.value, rejected, field);
            if (!interior) {
                return undefined;
            }

            if (interior !== node.value) {
                return new Filter(node.operator, node.field, interior);
            }

            return node;
        }

        return isRelationRejected(field, rejected) ? undefined : node;
    }

    if (!isFilters(node)) {
        return node;
    }

    const conditions : ICondition[] = [];
    for (const child of node.value) {
        const child2 = pruneCondition(child, rejected, prefix);
        if (child2) {
            conditions.push(child2);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(node.operator, conditions);
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
