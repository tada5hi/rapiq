/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ConditionPlan, ICondition, PlanConditionOptions } from '@rapiq/core';
import {
    AdapterError,
    Condition,
    Filter,
    Filters,
    IRValueTable,
    ITSELF,
    and,
    contains,
    distributeNegation,
    elemMatch,
    eq,
    exists,
    fromIR,
    gt,
    inArray,
    isBaseError,
    mod,
    nin,
    not,
    notStartsWith,
    or,
    planCondition,
    regex,
    size,
    startsWith,
    toIR,
} from '@rapiq/core';
import type { EvaluateGroup } from './evaluate.ts';

type ErrorFixture = {
    code: string, 
    message: string, 
    subject: string | null 
};

export type PlanGroup = {
    name: string,
    filters: unknown,
    options?: PlanConditionOptions,
    plan?: unknown,
    distributed?: unknown,
    error?: ErrorFixture,
};

/** A condition kind the built-in lowering does not know. */
class CustomCondition extends Condition<string> {
    constructor() {
        super('geoWithin', 'polygon');
    }
}

const special : [string, ICondition, PlanConditionOptions?][] = [
    // values JSON cannot carry faithfully cross as host references
    ['date equality', eq('created_at', new Date('2023-01-01T00:00:00Z'))],
    ['date ordering', gt('created_at', new Date('2023-01-01T00:00:00Z'))],
    ['date anchored text', startsWith('created_at', new Date('2023-01-01T00:00:00Z') as unknown as string)],
    ['date membership', inArray('created_at', [new Date('2023-01-01T00:00:00Z'), null])],
    ['regexp with stateful flags', regex('name', /^pe/gi)],
    ['regexp case-sensitive', regex('name', /^Pe/)],
    ['regexp sticky flag', regex('name', /pe/y)],
    ['regexp combined flags', regex('name', /^pe$/gimsuy)],
    ['regexp string', regex('name', '(a|b)+')],
    ['regexp invalid value', new Filter('regex', 'name', 5)],
    ['NaN equality', eq('n', NaN)],
    ['negative zero equality', eq('n', -0)],
    ['infinity ordering', gt('n', Infinity)],
    ['bigint equality', eq('n', 10n as unknown as number)],
    ['bigint membership', inArray('n', [1n, null, NaN] as unknown as number[])],
    ['exists NaN is falsy', exists('x', NaN as unknown as boolean)],
    ['exists 0n is falsy', exists('x', 0n as unknown as boolean)],
    ['exists object is truthy', exists('x', {} as unknown as boolean)],
    ['exists empty string is falsy', exists('x', '' as unknown as boolean)],
    ['mod negative zero remainder', mod('n', 3, -0)],
    ['mod negative zero divisor', mod('n', -0, 1)],
    ['mod NaN divisor', mod('n', NaN, 1)],
    ['size negative zero', size('tags', -0)],
    ['size infinity', new Filter('size', 'tags', Infinity)],
    ['object equality', eq('meta', { a: 1, b: [2, 3] })],
    ['array equality with undefined', eq('tags', ['a', undefined, 'b'] as unknown as string)],
    ['anchored number', contains('age', 18 as unknown as string)],
    ['anchored array', contains('x', ['a', null, 'b'] as unknown as string)],
    ['anchored object', contains('x', { a: 1 } as unknown as string)],
    ['anchored null', contains('x', null as unknown as string)],
    ['anchored undefined', contains('x', undefined as unknown as string)],
    ['anchored metacharacters', contains('x', 'a.b*c(d)|[e]{2}$^+?\\')],
    ['membership undefined items', inArray('x', [undefined, 'a'])],
    ['membership only undefined', nin('x', [undefined])],
    ['holes in a compound', new Filters('and', [eq('a', 1), undefined as unknown as ICondition, null as unknown as ICondition])],
    ['nested not', not(or(gt('a', 1), and(eq('b', 2), notStartsWith('c', 'x'))))],
    ['negated mod and size', not(and(mod('a', 2, 0), size('b', 1)))],
    ['negated elemMatch with ordering', not(elemMatch('items', and(gt('price', 5), eq('kind', 'book'))))],
    ['nor of orderings', new Filters('nor', [gt('a', 1), new Filter('lte', 'b', 2)])],
    ['case sensitive composed path', elemMatch('items', and(eq('name', 'Sword'), contains('tags', 'X'))), { caseSensitive: ['items.name'] }],
    ['case sensitive all, regex untouched', and(eq('a', 'X'), regex('b', /x/i)), { caseSensitive: true }],
    // refusals, with the exact messages
    ['custom condition at the root', new CustomCondition()],
    ['custom condition in a compound', and(eq('a', 1), new CustomCondition())],
    ['custom condition as elemMatch interior', new Filter('elemMatch', 'items', new CustomCondition())],
    ['detached data as elemMatch interior', new Filter('elemMatch', 'items', {
        operator: 'eq', 
        field: 'a', 
        value: 1, 
    })],
    ['non-condition elemMatch interior', new Filter('elemMatch', 'items', 5)],
    ['unknown compound operator', new Filters('xor', [eq('a', 1)])],
    ['unknown leaf operator', new Filter('like', 'a', 'x')],
    ['ITSELF outside elemMatch', eq(ITSELF, 1)],
    ['error order: earlier child wins', and(new Filter('like', 'a', 'x'), new CustomCondition())],
];

/**
 * The subject a TypeScript AdapterError was built from (the factory
 * argument): `feature` where the class records it, otherwise read back from
 * the factory's message template.
 */
function subjectOf(error: AdapterError) : string | null {
    if (error.feature) {
        return error.feature;
    }

    const operator = /^The filter operator (.+) is not supported\.$/.exec(error.message);
    if (operator) {
        return operator[1] as string;
    }

    const detached = /^The condition \((.+?)\) cannot be lowered/.exec(error.message);
    if (detached) {
        return detached[1] as string;
    }

    return null;
}

function encodePlan(plan: ConditionPlan | null, table: IRValueTable) : unknown {
    if (!plan) {
        return null;
    }

    switch (plan.kind) {
        case 'compound': {
            return { ...plan, children: plan.children.map((child) => encodePlan(child, table)) };
        }
        case 'compare': {
            return { ...plan, value: table.encode(plan.value) };
        }
        case 'one-of': {
            return { ...plan, values: plan.values.map((value) => table.encode(value)) };
        }
        case 'elem-match': {
            return { ...plan, condition: encodePlan(plan.condition, table) };
        }
        default: {
            return plan;
        }
    }
}

function group(name: string, condition: ICondition, options?: PlanConditionOptions) : PlanGroup {
    // the in-process binding path: every object crosses by reference
    const table = new IRValueTable({ objects: 'reference' });
    const filters = toIR(condition, table);
    const base : PlanGroup = {
        name, 
        filters, 
        ...(options ? { options } : {}), 
    };

    let plan : ConditionPlan | null;
    try {
        plan = planCondition(condition, options);
    } catch (e) {
        if (!isBaseError(e)) {
            throw e;
        }

        return {
            ...base,
            error: {
                code: e.code,
                message: e.message,
                subject: e instanceof AdapterError ? subjectOf(e) : null,
            },
        };
    }

    return {
        ...base,
        plan: encodePlan(plan, table),
        distributed: plan ? encodePlan(distributeNegation(plan), table) : null,
    };
}

export function buildPlanGroups(evaluate: EvaluateGroup[]) : PlanGroup[] {
    const groups = evaluate.map((item) => group(
        item.name,
        fromIR(item.filters as Parameters<typeof fromIR>[0]),
        item.options,
    ));

    for (const [name, condition, options] of special) {
        groups.push(group(name, condition, options));
    }

    return groups;
}
