/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Comparable } from '@ucast/core';
import type { Condition, Filter, Filters } from 'rapiq';
import type { FilterInterpreterWithContext } from '../interpreter';

export const eq: FilterInterpreterWithContext<Filter> = (
    condition,
    query,
) => query.where(condition.field, '=', condition.value);

export const ne: typeof eq = (
    condition,
    query,
) => query.where(condition.field, '<>', condition.value);

export const lt: FilterInterpreterWithContext<Filter<Comparable>> = (
    condition,
    query,
) => query.where(condition.field, '<', condition.value);

export const lte: FilterInterpreterWithContext<Filter<Comparable>> = (
    condition,
    query,
) => query.where(condition.field, '<=', condition.value);

export const gt: FilterInterpreterWithContext<Filter<Comparable>> = (
    condition,
    query,
) => query.where(condition.field, '>', condition.value);

export const gte: FilterInterpreterWithContext<Filter<Comparable>> = (
    condition,
    query,
) => query.where(condition.field, '>=', condition.value);

export const exists: FilterInterpreterWithContext<Filter<Comparable>> = (
    condition,
    query,
) => query.whereRaw(`${query.buildField(condition.field)} is ${condition.value ? 'not ' : ''}null`);

function manyParamsOperator(name: string): FilterInterpreterWithContext<Filter<unknown[]>> {
    return (
        condition,
        query,
        { rootAlias },
    ) => query.whereRaw(
        `${query.buildField(condition.field, rootAlias)} ${name}(${query.buildParamsPlaceholders(condition.value).join(', ')})`,
        ...condition.value,
    );
}

export const within = manyParamsOperator('in');
export const nin = manyParamsOperator('not in');

export const mod: FilterInterpreterWithContext<Filter<[number, number]>> = (
    condition,
    query,
) => {
    const params = query.buildParamsPlaceholders(condition.value);
    const sql = `mod(${query.buildField(condition.field)}, ${params[0]}) = ${params[1]}`;
    return query.whereRaw(sql, ...condition.value);
};

type IElemMatch = FilterInterpreterWithContext<Filter<Condition>>;
export const elemMatch: IElemMatch = (
    condition,
    query,
    { interpret },
) => {
    const oldPrefix = query.getFieldPrefix();

    query.setFieldPrefix(`${condition.field}.`);
    interpret(condition.value, query);

    query.setFieldPrefix(oldPrefix);

    return query;
};

export const regex: FilterInterpreterWithContext<Filter<RegExp>> = (
    condition,
    query,
) => {
    const sql = query.regexp(
        query.buildField(condition.field),
        query.buildParamPlaceholder(),
        condition.value.ignoreCase,
    );
    return query.whereRaw(sql, condition.value.source);
};

function compoundOperator(
    combinator: 'and' | 'or',
    isInverted: boolean = false,
) {
    return (
        (
            node,
            query,
            { interpret },
        ) => {
            const childQuery = query.child();
            node.value.forEach(
                (condition) => interpret(condition, childQuery),
            );
            return query.merge(childQuery, combinator, isInverted);
        }) as FilterInterpreterWithContext<Filters>;
}

export const not = compoundOperator('and', true);
export const and = compoundOperator('and');
export const or = compoundOperator('or');
export const nor = compoundOperator('or', true);
