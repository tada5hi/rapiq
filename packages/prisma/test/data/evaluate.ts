/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * A faithful, deliberately small evaluator for the prisma `where`
 * objects this adapter emits: the stand-in for a query engine so the
 * cross-backend semantics can be asserted without a database.
 *
 * It reproduces prisma's *three-valued* behavior, because that is
 * precisely what the adapter has to work around:
 *
 * - a scalar comparison against null/absent yields UNKNOWN, and a row
 *   only matches when the whole tree evaluates to TRUE,
 * - `equals: null` / `not: null` are the two-valued IS (NOT) NULL
 *   checks,
 * - `is` adds an "exists" conjunct, `isNot` an "or absent" disjunct,
 * - `some` / `none` are EXISTS / NOT EXISTS, hence two-valued,
 * - an empty `AND` is TRUE, an empty `OR` is FALSE.
 */
export type Verdict = boolean | null;

const RELATION_OPERATORS = ['is', 'isNot', 'some', 'every', 'none'];

function isPlainObject(input: unknown) : input is Record<string, any> {
    return typeof input === 'object' &&
        input !== null &&
        !Array.isArray(input) &&
        !(input instanceof Date) &&
        !(input instanceof RegExp);
}

function and(input: Verdict[]) : Verdict {
    let unknown = false;

    for (const item of input) {
        if (item === false) {
            return false;
        }

        if (item === null) {
            unknown = true;
        }
    }

    return unknown ? null : true;
}

function or(input: Verdict[]) : Verdict {
    let unknown = false;

    for (const item of input) {
        if (item === true) {
            return true;
        }

        if (item === null) {
            unknown = true;
        }
    }

    return unknown ? null : false;
}

function not(input: Verdict) : Verdict {
    return input === null ? null : !input;
}

function toArray(input: unknown) : any[] {
    return Array.isArray(input) ? input : [input];
}

// -----------------------------------------------------------

function normalize(input: unknown) : unknown {
    return typeof input === 'undefined' ? null : input;
}

function equals(value: unknown, operand: unknown, insensitive: boolean) : boolean {
    if (
        insensitive &&
        typeof value === 'string' &&
        typeof operand === 'string'
    ) {
        return value.toLowerCase() === operand.toLowerCase();
    }

    return value === operand;
}

function compare(value: any, operand: any) : number | undefined {
    if (typeof value === 'string' && typeof operand === 'string') {
        if (value === operand) {
            return 0;
        }

        return value < operand ? -1 : 1;
    }

    if (typeof value === 'number' && typeof operand === 'number') {
        if (value === operand) {
            return 0;
        }

        return value < operand ? -1 : 1;
    }

    return undefined;
}

function text(value: unknown, operand: string, insensitive: boolean) : [string, string] | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    if (insensitive) {
        return [value.toLowerCase(), operand.toLowerCase()];
    }

    return [value, operand];
}

// -----------------------------------------------------------

function evaluateOperator(
    operator: string,
    operand: any,
    value: unknown,
    insensitive: boolean,
) : Verdict {
    if (operator === 'equals') {
        if (operand === null) {
            return normalize(value) === null;
        }

        if (normalize(value) === null) {
            return null;
        }

        return equals(value, operand, insensitive);
    }

    if (operator === 'not') {
        if (operand === null) {
            return normalize(value) !== null;
        }

        if (isPlainObject(operand)) {
            // the sibling `mode` applies into the negated subtree.
            return not(evaluateScalar(value, operand, insensitive));
        }

        if (normalize(value) === null) {
            return null;
        }

        return !equals(value, operand, insensitive);
    }

    if (operator === 'in' || operator === 'notIn') {
        if (normalize(value) === null) {
            return null;
        }

        const contained = (operand as unknown[]).some(
            (item) => equals(value, item, insensitive),
        );

        return operator === 'in' ? contained : !contained;
    }

    if (
        operator === 'lt' ||
        operator === 'lte' ||
        operator === 'gt' ||
        operator === 'gte'
    ) {
        if (normalize(value) === null || operand === null) {
            return null;
        }

        const result = compare(value, operand);
        if (typeof result === 'undefined') {
            return null;
        }

        switch (operator) {
            case 'lt': return result === -1;
            case 'lte': return result <= 0;
            case 'gt': return result === 1;
            default: return result >= 0;
        }
    }

    if (
        operator === 'contains' ||
        operator === 'startsWith' ||
        operator === 'endsWith'
    ) {
        if (normalize(value) === null) {
            return null;
        }

        const pair = text(value, operand as string, insensitive);
        if (!pair) {
            return null;
        }

        const [haystack, needle] = pair;

        switch (operator) {
            case 'contains': return haystack.includes(needle);
            case 'startsWith': return haystack.startsWith(needle);
            default: return haystack.endsWith(needle);
        }
    }

    throw new Error(`Unsupported prisma filter operator: ${operator}`);
}

function evaluateScalar(
    value: unknown,
    filter: Record<string, any>,
    inherited = false,
) : Verdict {
    const insensitive = inherited || filter.mode === 'insensitive';

    const results : Verdict[] = [];

    for (const key of Object.keys(filter)) {
        if (key === 'mode') {
            continue;
        }

        results.push(evaluateOperator(key, filter[key], value, insensitive));
    }

    return and(results);
}

function evaluateRelation(value: unknown, filter: Record<string, any>) : Verdict {
    const results : Verdict[] = [];

    for (const key of Object.keys(filter)) {
        const operand = filter[key];

        if (key === 'is' || key === 'isNot') {
            const present = normalize(value) !== null;

            if (operand === null) {
                results.push(key === 'is' ? !present : present);
                continue;
            }

            const inner = evaluateWhere(operand, (value || {}) as Record<string, any>);

            // `is` renders the interior plus an exists guard; `isNot`
            // the negated interior or the absence of the record.
            results.push(key === 'is' ?
                and([inner, present]) :
                or([not(inner), !present]));

            continue;
        }

        const items = Array.isArray(value) ? value : [];

        if (key === 'some' || key === 'none') {
            const exists = items.some(
                (item) => evaluateWhere(operand, item) === true,
            );

            results.push(key === 'some' ? exists : !exists);
            continue;
        }

        if (key === 'every') {
            results.push(!items.some(
                (item) => not(evaluateWhere(operand, item)) === true,
            ));
            continue;
        }

        throw new Error(`Unsupported prisma relation operator: ${key}`);
    }

    return and(results);
}

function evaluateField(value: unknown, filter: unknown) : Verdict {
    if (filter === null) {
        return normalize(value) === null;
    }

    if (!isPlainObject(filter)) {
        return evaluateOperator('equals', filter, value, false);
    }

    if (Object.keys(filter).some((key) => RELATION_OPERATORS.includes(key))) {
        return evaluateRelation(value, filter);
    }

    return evaluateScalar(value, filter);
}

export function evaluateWhere(where: Record<string, any>, row: Record<string, any>) : Verdict {
    const results : Verdict[] = [];

    for (const key of Object.keys(where)) {
        const value = where[key];

        if (key === 'AND') {
            results.push(and(toArray(value).map((item) => evaluateWhere(item, row))));
            continue;
        }

        if (key === 'OR') {
            results.push(or((value as any[]).map((item) => evaluateWhere(item, row))));
            continue;
        }

        if (key === 'NOT') {
            results.push(and(toArray(value).map((item) => not(evaluateWhere(item, row)))));
            continue;
        }

        results.push(evaluateField(row[key], value));
    }

    return and(results);
}

/**
 * The rows a `where` selects: a row matches only when the tree
 * evaluates to TRUE, exactly like a SQL `WHERE`.
 */
export function selectRows<T extends Record<string, any>>(
    where: Record<string, any> | undefined,
    rows: T[],
) : T[] {
    if (!where) {
        return [...rows];
    }

    return rows.filter((row) => evaluateWhere(where, row) === true);
}
