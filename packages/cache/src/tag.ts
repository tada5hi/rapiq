/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * A value a scoped tag can carry. Anything else (an object, an array, a
 * Date, undefined) has no stable spelling both sides derive alike, so it
 * never produces a scoped tag and the reader falls back to the collection.
 */
export type ScopedTagValue = string | number | boolean | null;

export function isScopedTagValue(value: unknown) : value is ScopedTagValue {
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
 */
export function buildScopedTag(schema: string, column: string, value: ScopedTagValue) : string {
    return `${schema}:${column}=${String(value)}`;
}
