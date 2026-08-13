/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import { ErrorCode, ErrorMessage, SchemaError } from '../errors';
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
import type { FiltersSchema, SortsSchema } from '../schema';
import { parseKey } from '../utils';
import type { IssueCollector } from './issue';
import { buildFiltersDefaults } from './parameter/filters/validate';

/**
 * Record what a rejected relation took with it. The rejection itself was
 * already reported by the relations gate; these are its consequences, so they
 * never fail a parse that the gate let through — but they are the difference
 * between "my sort was ignored" and knowing why.
 */
function recordPruned(
    issues: IssueCollector | undefined,
    parameter: `${Parameter}`,
    name: string,
) : void {
    if (!issues) {
        return;
    }

    issues.notice({
        code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        parameter,
        path: name.split('.'),
        message: ErrorMessage.keyPathNotPermitted(name),
    });
}

/**
 * Record that a parameter fell back to its schema default because nothing the
 * client sent survived — the "I asked for X and got Y" case, which is
 * otherwise indistinguishable from a request that asked for nothing.
 */
function recordDefaults(
    issues: IssueCollector | undefined,
    parameter: `${Parameter}`,
    applied: boolean,
) : void {
    if (!issues || !applied) {
        return;
    }

    issues.notice({
        code: ErrorCode.NONE,
        parameter,
        path: [],
        message: ErrorMessage.defaultsApplied(),
    });
}

/**
 * Whether an entry survives the gate, recording it when it does not.
 */
function keep(
    name: string,
    rejected: string[],
    issues: IssueCollector | undefined,
    parameter: `${Parameter}`,
) : boolean {
    const matched = matchRelationRejected(name, rejected);
    if (typeof matched === 'undefined') {
        return true;
    }

    // the rejected relation itself was already reported by the gate that
    // rejected it; only what it dragged along is news.
    if (!(parameter === Parameter.RELATIONS && matched === name)) {
        recordPruned(issues, parameter, name);
    }

    return false;
}

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
export function pruneFieldsByRelations(
    fields: IFields,
    rejected: string[],
    issues?: IssueCollector,
) : IFields {
    if (rejected.length === 0) {
        return fields;
    }

    return new Fields(
        fields.value
            .filter((field) => keep(field.name, rejected, issues, Parameter.FIELDS))
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
    schema?: SortsSchema,
    issues?: IssueCollector,
) : ISorts {
    if (rejected.length === 0) {
        return sorts;
    }

    const value = sorts.value
        .filter((sort) => keep(sort.name, rejected, issues, Parameter.SORTS))
        .map((sort) => new Sort(sort.name, sort.operator));

    if (value.length === 0 && schema) {
        const defaults = buildSortsDefaults(schema);
        recordDefaults(issues, Parameter.SORTS, defaults.value.length > 0);

        return defaults;
    }

    return new Sorts(value);
}

/**
 * Drop every relation at or below a rejected relation.
 */
export function pruneRelationsByRelations(
    relations: IRelations,
    rejected: string[],
    issues?: IssueCollector,
) : IRelations {
    if (rejected.length === 0) {
        return relations;
    }

    return new Relations(
        relations.value
            .filter((relation) => keep(relation.name, rejected, issues, Parameter.RELATIONS))
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
    issues?: IssueCollector,
) : IFilters {
    if (rejected.length === 0) {
        return filters;
    }

    const pruned = pruneCondition(filters, rejected, '', false, issues);
    if (pruned && isFilters(pruned)) {
        return pruned;
    }

    let conditions : ICondition[];
    if (pruned) {
        conditions = [pruned];
    } else {
        conditions = schema ? buildFiltersDefaults(schema) : [];
        recordDefaults(issues, Parameter.FILTERS, conditions.length > 0);

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
    issues?: IssueCollector,
) : ICondition | undefined {
    // The marker protects the whole subtree it heads. `preserve()` sets it on
    // the built-in nodes and wraps anything else, but the marker itself is
    // part of ICondition, so a custom condition setting it is honoured too.
    const preserved2 = preserved || isConditionPreservedAtRoot(node);

    if (isFilter(node)) {
        const field = joinPath(prefix, node.field);
        const rejectedBy = matchRelationRejected(field, rejected);

        // Dropping a leaf drops everything addressed below it, so the refusal
        // is decided over the whole subtree rather than this node alone: an
        // interior condition (`elemMatch`, or any operator built the same way)
        // can carry the marker its parent does not.
        if (typeof rejectedBy === 'string') {
            const output = dropUnlessPreserved(
                rejectedBy,
                field,
                preserved2 || isConditionPreserved(node),
            );

            recordPruned(issues, Parameter.FILTERS, field);

            return output;
        }

        // Descending is gated on the operator, not on the value shape: only
        // `elemMatch` is known to address its interior relative to the element,
        // which is what `field` becomes the prefix for.
        if (
            node.operator === FilterFieldOperator.ELEM_MATCH &&
            isCondition(node.value)
        ) {
            const interior = pruneCondition(node.value, rejected, field, preserved2, issues);
            if (!interior) {
                return undefined;
            }

            if (interior !== node.value) {
                return new Filter(node.operator, node.field, interior, { preserved: node.preserved });
            }
        }

        return node;
    }

    if (!isFilters(node)) {
        return node;
    }

    const conditions : ICondition[] = [];
    for (const child of node.value) {
        const child2 = pruneCondition(child, rejected, prefix, preserved2, issues);
        if (child2) {
            conditions.push(child2);
        }
    }

    if (conditions.length === 0) {
        return undefined;
    }

    return new Filters(node.operator, conditions, { preserved: node.preserved });
}

function isConditionPreservedAtRoot(node: ICondition) : boolean {
    return node.preserved === true;
}

function isConditionPreserved(node: ICondition) : boolean {
    if (isConditionPreservedAtRoot(node)) {
        return true;
    }

    if (isFilters(node)) {
        return node.value.some((child) => isConditionPreserved(child));
    }

    // A leaf value can be a condition in its own right, and it goes away with
    // the leaf. The addressing convention does not matter here: the question
    // is only whether anything below is marked.
    if (isFilter(node) && isCondition(node.value)) {
        return isConditionPreserved(node.value);
    }

    return false;
}

export function buildSortsDefaults(schema: SortsSchema) : Sorts {
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

/**
 * @deprecated use {@link buildSortsDefaults}. Removed in 3.0.
 */
export const buildSortDefaults = buildSortsDefaults;
