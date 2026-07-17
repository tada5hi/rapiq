/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import type { Condition, ICondition, IFilters } from '../../../parameter';
import {
    Filter, 
    Filters, 
    ITSELF, 
    isFilter, 
    isFilters,
} from '../../../parameter';
import { FilterCompoundOperator, FilterFieldOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';
import type { FiltersBuildInput } from './types';

const OPERATORS : Record<string, string> = {};
for (const operator of Object.values(FilterFieldOperator)) {
    OPERATORS[`$${operator}`] = operator;
}

/**
 * The generic-less overload comes first: without an explicit record
 * generic, input is checked against the plain-string grammar instead of
 * letting inference derive RECORD from the argument.
 */
export function defineFilters(input: FiltersBuildInput<ObjectLiteral> | ICondition) : IFilters;
export function defineFilters<
    RECORD extends ObjectLiteral,
>(input: FiltersBuildInput<RECORD> | ICondition) : IFilters;
export function defineFilters(input: FiltersBuildInput<ObjectLiteral> | ICondition) : IFilters {
    if (isParameterNode<Filter | Filters>(input)) {
        assertConditionFields(input, false);

        if (isFilters(input)) {
            return input;
        }

        // a single leaf condition — wrap it into the canonical root-AND.
        return new Filters(FilterCompoundOperator.AND, [input]);
    }

    return new Filters(
        FilterCompoundOperator.AND,
        buildConditions(input),
    );
}

function buildConditions(
    input: unknown,
    prefix?: string,
    insideElemMatch = false,
) : Condition[] {
    if (!isObject(input)) {
        throw BuildError.inputInvalid();
    }

    const output : Condition[] = [];

    const keys = Object.keys(input);
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'undefined') {
            continue;
        }

        // a $-prefixed key is never a field name — with one exception:
        // the ITSELF marker addresses the array element inside an
        // elemMatch interior.
        if (key.startsWith('$') && !(key === ITSELF && insideElemMatch && !prefix)) {
            throw BuildError.keyInvalid(key);
        }

        output.push(...buildFieldConditions(
            prefix ? `${prefix}.${key}` : key,
            value,
            insideElemMatch,
        ));
    }

    return output;
}

function buildFieldConditions(
    field: string,
    value: unknown,
    insideElemMatch = false,
) : Condition[] {
    // the ITSELF marker is only legal as a complete field —
    // it addresses the element itself and has no dotted form.
    if (field !== ITSELF && field.split('.').includes(ITSELF)) {
        throw BuildError.keyInvalid(field);
    }

    // bare array = IN sugar; null is a legal element,
    // backend adapters own the `OR IS NULL` rewrite.
    if (Array.isArray(value)) {
        return [new Filter(FilterFieldOperator.IN, field, value)];
    }

    if (value instanceof RegExp) {
        return [new Filter(FilterFieldOperator.REGEX, field, value)];
    }

    if (value instanceof Date) {
        return [new Filter(FilterFieldOperator.EQUAL, field, value)];
    }

    // a condition node already carries its own field — as a field value
    // it is ambiguous input and must not be expanded like a record.
    if (isParameterNode(value)) {
        throw BuildError.keyValueInvalid(field);
    }

    if (isObject(value)) {
        const keys = Object.keys(value);

        const isOperatorInput = keys.some((key) => key.substring(0, 1) === '$');
        if (isOperatorInput) {
            const output : Condition[] = [];
            for (const key of keys) {
                // optional operator keys may be present but undefined
                // (conditional spreads) — they carry no condition.
                if (typeof value[key] === 'undefined') {
                    continue;
                }

                output.push(buildOperatorCondition(field, key, value[key]));
            }

            return output;
        }

        // nested record — relation traversal via dot-path prefixing;
        // the element itself has no properties to traverse into.
        if (field === ITSELF) {
            throw BuildError.keyValueInvalid(field);
        }

        return buildConditions(value, field, insideElemMatch);
    }

    // scalar (incl. null) = EQUAL sugar.
    return [new Filter(FilterFieldOperator.EQUAL, field, value)];
}

function buildOperatorCondition(
    field: string,
    key: string,
    value: unknown,
) : Condition {
    if (key === `$${FilterFieldOperator.ELEM_MATCH}`) {
        let condition : Condition;
        if (isParameterNode<Filter | Filters>(value)) {
            assertConditionFields(value, true);

            condition = value;
        } else {
            let conditions : Condition[];
            if (
                isObject(value) &&
                Object.keys(value).every((child) => child.startsWith('$') && child !== ITSELF)
            ) {
                // element-level operator object (mongo's
                // { $elemMatch: { $gt: 5 } }) — the operators apply
                // to the element itself.
                conditions = buildFieldConditions(ITSELF, value, true);
            } else {
                conditions = buildConditions(value, undefined, true);
            }

            const [first] = conditions;
            condition = first && conditions.length === 1 ?
                first :
                new Filters(FilterCompoundOperator.AND, conditions);
        }

        return new Filter(FilterFieldOperator.ELEM_MATCH, field, condition);
    }

    if (key.substring(0, 1) !== '$') {
        throw BuildError.keyInvalid(key);
    }

    const operator = OPERATORS[key];
    if (!operator) {
        throw BuildError.operatorUnsupported(key);
    }

    if (
        operator === FilterFieldOperator.IN ||
        operator === FilterFieldOperator.NOT_IN
    ) {
        return new Filter(operator, field, Array.isArray(value) ? value : [value]);
    }

    return new Filter(operator, field, value);
}

/**
 * Verify the ITSELF marker contract on a pre-built condition tree:
 * the marker is only legal as the complete field of a condition
 * inside an elemMatch interior.
 */
function assertConditionFields(
    input: ICondition,
    insideElemMatch: boolean,
) : void {
    if (isFilters(input)) {
        for (const child of input.value) {
            if (isParameterNode<Filter | Filters>(child)) {
                assertConditionFields(child, insideElemMatch);
            }
        }

        return;
    }

    if (!isFilter(input)) {
        return;
    }

    if (input.field === ITSELF) {
        if (!insideElemMatch) {
            throw BuildError.keyInvalid(input.field);
        }
    } else if (input.field.split('.').includes(ITSELF)) {
        throw BuildError.keyInvalid(input.field);
    }

    if (
        input.operator === FilterFieldOperator.ELEM_MATCH &&
        isParameterNode<Filter | Filters>(input.value)
    ) {
        assertConditionFields(input.value, true);
    }
}
