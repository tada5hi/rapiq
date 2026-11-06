import type { ScopedTagValue } from './types';


export function isScopedTagValue(value: unknown) : value is ScopedTagValue {
    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }

    return value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean';
}

/**
 * The tag every result selected from a schema's rows depends on: `role`.
 *
 * `schema` is the rapiq schema NAME (`Schema.name`), on both the reading
 * and the writing side.
 */
export function buildCollectionTag(schema: string) : string {
    return schema;
}

/**
 * The tag one row carries: `role:<id>`.
 */
export function buildRecordTag(schema: string, id: string | number) : string {
    return `${schema}:${id}`;
}

/**
 * The tag a result selected by one column value depends on:
 * `userRole:userId=<value>`. `null` is spelled `null`.
 *
 * The spelling is canonical, so the types a database treats as equal meet:
 * a boolean is spelled `1` or `0` (as the number a filter may carry for it)
 * and a Date as its epoch milliseconds. Within one column `true` and `1`
 * therefore share a tag, which can only over-invalidate.
 */
export function buildScopedTag(schema: string, column: string, value: ScopedTagValue) : string {
    return `${schema}:${column}=${spellScopedTagValue(value)}`;
}

function spellScopedTagValue(value: ScopedTagValue) : string {
    if (typeof value === 'boolean') {
        return value ? '1' : '0';
    }

    if (value instanceof Date) {
        return String(value.getTime());
    }

    return String(value);
}
