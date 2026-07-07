/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import type { Condition, ICondition, IFilters } from '../../../parameter';
import { Filter, Filters, isFilters } from '../../../parameter';
import { FilterCompoundOperator, FilterFieldOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';
import type { FiltersBuildInput } from './types';

const OPERATORS : Record<string, string> = {};
for (const operator of Object.values(FilterFieldOperator)) {
    OPERATORS[`$${operator}`] = operator;
}

export function defineFilters<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(input: FiltersBuildInput<RECORD> | ICondition) : IFilters {
    if (isParameterNode<Filter | Filters>(input)) {
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

        output.push(...buildFieldConditions(
            prefix ? `${prefix}.${key}` : key,
            value,
        ));
    }

    return output;
}

function buildFieldConditions(
    field: string,
    value: unknown,
) : Condition[] {
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

        // nested record — relation traversal via dot-path prefixing.
        return buildConditions(value, field);
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
            condition = value;
        } else {
            const conditions = buildConditions(value);
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
