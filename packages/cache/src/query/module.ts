/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IFilters,
    IQuery,
    Schema,
    SchemaRegistry,
} from '@rapiq/core';
import {
    FilterCompoundOperator,
    FilterFieldOperator,
    isFilter,
    isFilters,
    isObject,
    parseKey,
    toDate,
    toIssuePath,
} from '@rapiq/core';
import { CacheError } from '../errors';
import {
    buildCollectionTag,
    buildRecordTag,
    buildScopedTag,
    isScopedTagValue,
} from '../tag';
import type { ScopedTagValue } from '../tag';
import type { ITaggedCache } from '../types';
import type { QueryTagsInput, RememberQueryInput } from './types';

/**
 * Whether a result of the query may be shared between callers.
 *
 * A `Field` carrying a `condition` is a per-actor visibility verdict: the
 * projection depends on who asked, which the cache key cannot carry.
 */
export function isCacheable(query: IQuery) : boolean {
    for (const field of query.fields.value) {
        if (typeof field.condition !== 'undefined') {
            return false;
        }
    }

    return true;
}

/**
 * The tags a result of `query` over `schema` depends on, deduplicated, in
 * three groups: the root collection (or the scoped tags replacing it), the
 * collections of every relation the query reaches, and the record tags of
 * every row the result holds.
 */
export function collectQueryTags(input: QueryTagsInput) : string[] {
    const schema = resolveRootSchema(input.registry, input.schema);
    const name = resolveSchemaName(schema);
    const key = input.key ?? 'id';

    const tags = new Set<string>();

    // 1. the root collection dependency
    const scoped = collectScopedTags(schema, name, input.query.filters);
    if (scoped.length > 0) {
        for (const tag of scoped) {
            tags.add(tag);
        }
    } else {
        tags.add(buildCollectionTag(name));
    }

    // 2. relation collection dependencies
    const paths = new Map<string, Schema[]>();
    for (const path of collectRelationPaths(input.query)) {
        if (paths.has(path)) {
            continue;
        }

        const chain = resolveRelationChain(input.registry, schema, path);
        paths.set(path, chain);

        for (const target of chain) {
            tags.add(buildCollectionTag(resolveSchemaName(target)));
        }
    }

    // 3. record dependencies
    const rows = toRows(input.value);
    for (const row of rows) {
        const id = readId(row, key);
        if (typeof id !== 'undefined') {
            tags.add(buildRecordTag(name, id));
        }
    }

    for (const relation of input.query.relations.value) {
        const chain = paths.get(relation.name) ??
            resolveRelationChain(input.registry, schema, relation.name);
        const segments = toIssuePath(relation.name);

        let reached : Record<string, any>[] = rows;
        for (const [index, target] of chain.entries()) {
            const segment = segments[index];
            if (typeof segment === 'undefined') {
                break;
            }

            reached = reached.flatMap((row) => toRows(row[segment]));

            const targetName = resolveSchemaName(target);
            for (const row of reached) {
                const id = readId(row, key);
                if (typeof id !== 'undefined') {
                    tags.add(buildRecordTag(targetName, id));
                }
            }
        }
    }

    return Array.from(tags);
}

/**
 * Read through the cache when the query may be shared, straight from the
 * source otherwise.
 */
export async function rememberQuery<T>(
    cache: ITaggedCache,
    input: RememberQueryInput,
    read: () => Promise<T>,
) : Promise<T> {
    if (!isCacheable(input.query)) {
        return read();
    }

    return cache.remember(input.key, read, {
        tags: (value) => collectQueryTags({
            query: input.query,
            schema: input.schema,
            registry: input.registry,
            value,
            key: input.primaryKey,
        }),
    });
}

// ----------------------------------------------------

function resolveRootSchema(registry: SchemaRegistry, input: Schema | string) : Schema {
    const schema = registry.get(input);
    if (typeof schema === 'undefined') {
        throw CacheError.schemaUnresolvable(typeof input === 'string' ? input : String(input.name));
    }

    return schema;
}

function resolveSchemaName(schema: Schema) : string {
    if (typeof schema.name === 'undefined') {
        throw CacheError.schemaNameUndefined();
    }

    return schema.name;
}

/**
 * The schemas a relation path walks through, one per segment.
 */
function resolveRelationChain(registry: SchemaRegistry, root: Schema, path: string) : Schema[] {
    const chain : Schema[] = [];

    let current = root;
    for (const segment of toIssuePath(path)) {
        const next = registry.get(current.mapSchema(segment));
        if (typeof next === 'undefined') {
            throw CacheError.relationUnresolvable(resolveSchemaName(current), segment);
        }

        chain.push(next);
        current = next;
    }

    return chain;
}

/**
 * The top-level conjuncts a root filter tree contributes: the flattened
 * children of a non-preserved AND, or the whole tree as one conjunct.
 */
function toConjuncts(filters: IFilters) : ICondition[] {
    if (
        filters.operator === FilterCompoundOperator.AND &&
        !filters.preserved
    ) {
        return filters.flatten().value;
    }

    return [filters];
}

function leadsIndex(schema: Schema, field: string) : boolean {
    return schema.indexes.some((index) => index[0] === field);
}

/**
 * Whether a filter value spells the value the writer's row carries. A
 * scoped tag is exact string equality between the two, which a date
 * string cannot promise: the reader keeps the ISO string the wire carried
 * while the writer's row holds a `Date` (no scoped tag at all) or the
 * database's own storage form. Such a conjunct keeps the collection tag.
 */
function isScopableValue(value: unknown) : value is ScopedTagValue {
    if (!isScopedTagValue(value)) {
        return false;
    }

    return typeof value !== 'string' || typeof toDate(value) === 'undefined';
}

/**
 * Rule 1: an `eq` or `in` conjunct on an undotted, index-leading column
 * with scalar value(s) scopes the collection dependency to that column. A
 * date string never scopes (see `isScopableValue`).
 */
function collectScopedTags(schema: Schema, name: string, filters: IFilters) : string[] {
    const output : string[] = [];

    for (const conjunct of toConjuncts(filters)) {
        if (!isFilter(conjunct)) {
            continue;
        }

        const details = parseKey(conjunct.field);
        if (details.path) {
            continue;
        }

        if (!leadsIndex(schema, details.name)) {
            continue;
        }

        if (conjunct.operator === FilterFieldOperator.EQUAL) {
            if (isScopableValue(conjunct.value)) {
                output.push(buildScopedTag(name, details.name, conjunct.value));
            }

            continue;
        }

        if (
            conjunct.operator === FilterFieldOperator.IN &&
            Array.isArray(conjunct.value) &&
            conjunct.value.length > 0 &&
            conjunct.value.every(isScopableValue)
        ) {
            for (const value of conjunct.value) {
                output.push(buildScopedTag(name, details.name, value));
            }
        }
    }

    return output;
}

/**
 * Rule 2: every relation path the query reaches, explicitly included or
 * implied by a dotted filter, sort or field key.
 */
function collectRelationPaths(query: IQuery) : string[] {
    const output : string[] = [];

    for (const relation of query.relations.value) {
        output.push(relation.name);
    }

    for (const field of collectFilterFields(query.filters)) {
        pushKeyPath(output, field);
    }

    for (const sort of query.sorts.value) {
        pushKeyPath(output, sort.name);
    }

    for (const field of query.fields.value) {
        pushKeyPath(output, field.name);
    }

    return output;
}

function pushKeyPath(output: string[], key: string) {
    const { path } = parseKey(key);
    if (path) {
        output.push(path);
    }
}

function collectFilterFields(condition: ICondition, output: string[] = []) : string[] {
    if (isFilter(condition)) {
        output.push(condition.field);
        return output;
    }

    if (isFilters(condition)) {
        for (const child of condition.value) {
            collectFilterFields(child, output);
        }
    }

    return output;
}

function toRows(value: unknown) : Record<string, any>[] {
    if (Array.isArray(value)) {
        return value.filter(isObject);
    }

    if (isObject(value)) {
        return [value];
    }

    return [];
}

function readId(row: Record<string, any>, key: string) : string | number | undefined {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') {
        return value;
    }

    return undefined;
}
