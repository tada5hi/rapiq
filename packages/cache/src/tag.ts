/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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

/**
 * Exactly the uuid spellings postgres' `uuid_in` reads: 32 hex digits, a
 * hyphen optional after any group of four, the whole optionally in one
 * pair of braces.
 */
const UUID_INPUT = /^(?:\{[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}\}|[0-9a-f]{4}(?:-?[0-9a-f]{4}){7})$/i;

/**
 * A `ScopedTagValueNormalizer` for uuid columns: a string spelling a uuid
 * (any spelling postgres accepts: either case, braced, hyphen-less) is
 * answered in the canonical form postgres outputs and TypeORM generates,
 * hyphenated and lower-case. Everything else passes through untouched.
 *
 * Hand the same function to the reader and the writer. Folding several
 * spellings into one tag can only over-invalidate: two values a column
 * keeps apart (a case-sensitive text column holding both `ABC...` and
 * `abc...`) then share a tag, which bumps more readers, never fewer.
 */
export function normalizeScopedUuid(_schema: string, _column: string, value: ScopedTagValue) : ScopedTagValue {
    if (typeof value !== 'string' || !UUID_INPUT.test(value)) {
        return value;
    }

    const hex = value.replace(/[{}-]/g, '').toLowerCase();

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
