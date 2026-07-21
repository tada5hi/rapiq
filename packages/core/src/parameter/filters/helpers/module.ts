/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator, FilterFieldOperator } from '../../../schema';
import type { NestedKeys, ObjectLiteral } from '../../../types';
import { Filters } from '../collection';
import type { Condition } from '../condition';
import { Filter } from '../record';

/**
 * Field paths are typed against the record generic when one is supplied
 * (helper<User>('realm.name', ...)); without a generic the parameter
 * falls back to a plain string.
 */
type FieldKey<RECORD extends ObjectLiteral> = string extends keyof RECORD ?
    string :
    NestedKeys<RECORD>;

/**
 * One helper per {@link FilterFieldOperator}, named after the operator's
 * enum value, mirroring the expression dialect (eq('name', 'John') in
 * code ≙ eq(name, 'John') on the wire). Sole exception: `in` is a
 * reserved word in JavaScript, so the IN helper is named {@link inArray}.
 */

export function eq<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.EQUAL, field, value);
}

export function ne<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.NOT_EQUAL, field, value);
}

export function lt<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.LESS_THAN, field, value);
}

export function lte<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.LESS_THAN_EQUAL, field, value);
}

export function gt<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.GREATER_THAN, field, value);
}

export function gte<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown,
) : Filter {
    return new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, field, value);
}

/**
 * IN condition (wire keyword: `in`). `null` is a legal element;
 * backend adapters own the `OR IS NULL` rewrite.
 */
export function inArray<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown[],
) : Filter {
    return new Filter(FilterFieldOperator.IN, field, value);
}

export function nin<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: unknown[],
) : Filter {
    return new Filter(FilterFieldOperator.NOT_IN, field, value);
}

export function startsWith<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.STARTS_WITH, field, value);
}

export function notStartsWith<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.NOT_STARTS_WITH, field, value);
}

export function endsWith<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.ENDS_WITH, field, value);
}

export function notEndsWith<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.NOT_ENDS_WITH, field, value);
}

export function contains<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.CONTAINS, field, value);
}

export function notContains<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: string,
) : Filter {
    return new Filter(FilterFieldOperator.NOT_CONTAINS, field, value);
}

export function regex<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: RegExp | string,
) : Filter {
    return new Filter(FilterFieldOperator.REGEX, field, value);
}

export function mod<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    divisor: number,
    remainder: number,
) : Filter {
    return new Filter(FilterFieldOperator.MOD, field, [divisor, remainder]);
}

/**
 * Match arrays with exactly the given number of elements
 * (a non-negative integer); missing or non-array values never match.
 */
export function size<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: number,
) : Filter {
    return new Filter(FilterFieldOperator.SIZE, field, value);
}

export function exists<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: boolean = true,
) : Filter {
    return new Filter(FilterFieldOperator.EXISTS, field, value);
}

/**
 * Match array elements against a condition; field paths inside the
 * condition are relative to the array element.
 */
export function elemMatch<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: Condition,
) : Filter {
    return new Filter(FilterFieldOperator.ELEM_MATCH, field, value);
}

export function and(...conditions: Condition[]) : Filters {
    return new Filters(FilterCompoundOperator.AND, conditions);
}

export function or(...conditions: Condition[]) : Filters {
    return new Filters(FilterCompoundOperator.OR, conditions);
}

/**
 * Negation: matches exactly what the interior does not match — the
 * null-inclusive complement law extended from negated leaf operators
 * to arbitrary condition trees. Multiple conditions negate their
 * conjunction: not(a, b) ≙ not(and(a, b)).
 */
export function not(...conditions: Condition[]) : Filters {
    return new Filters(FilterCompoundOperator.NOT, conditions);
}
