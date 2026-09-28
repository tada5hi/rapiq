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
    ITSELF,
    isCondition,
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
import type { QueryCaseSensitive, QueryTagsInput, RememberQueryInput } from './types';

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
export function collectQueryTags<T = unknown>(input: QueryTagsInput<T>) : string[] {
    const schema = resolveRootSchema(input.registry, input.schema);
    const name = resolveSchemaName(schema);
    const key = input.primaryKey ?? 'id';

    const tags = new Set<string>();

    // 1. the root collection dependency
    const scoped = collectScopedTags(schema, name, input.query.filters, input.caseSensitive);
    if (scoped.length > 0) {
        for (const tag of scoped) {
            tags.add(tag);
        }
    } else {
        tags.add(buildCollectionTag(name));
    }

    // 2. relation collection dependencies
    const paths = new Map<string, Schema[]>();
    for (const path of collectRelationPaths(input.registry, schema, input.query)) {
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
    const rows = toRows(input.rows ? input.rows(input.value) : input.value);
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
    input: RememberQueryInput<T>,
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
            rows: input.rows,
            primaryKey: input.primaryKey,
            caseSensitive: input.caseSensitive,
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
 * scoped tag is exact equality between the two canonical spellings (see
 * `buildScopedTag`), which a date string cannot promise: the reader keeps
 * the ISO string the wire carried while the writer's row holds a `Date`
 * (spelled as its epoch) or the database's own storage form. Such a
 * conjunct keeps the collection tag.
 */
function isScopableValue(value: unknown, caseSensitive: boolean) : value is ScopedTagValue {
    if (!isScopedTagValue(value)) {
        return false;
    }

    if (typeof value !== 'string') {
        return true;
    }

    return caseSensitive && typeof toDate(value) === 'undefined';
}

function isCaseSensitive(caseSensitive: QueryCaseSensitive | undefined, field: string) : boolean {
    if (caseSensitive === true) {
        return true;
    }

    return Array.isArray(caseSensitive) && caseSensitive.includes(field);
}

/**
 * Rule 1: an `eq` or `in` conjunct on an undotted, index-leading column
 * with scalar value(s) scopes the collection dependency to that column. A
 * date string never scopes (see `isScopableValue`), and neither does a
 * string on a column the query is not executed case-sensitively on: the
 * adapter then folds the comparison, so `U1` matches a row holding `u1`
 * while the writer bumps `u1`. Case sensitivity is the adapter's
 * `execute({ caseSensitive })` option, never the schema's list, since only
 * the option changes the SQL.
 */
function collectScopedTags(
    schema: Schema,
    name: string,
    filters: IFilters,
    caseSensitiveInput: QueryCaseSensitive | undefined,
) : string[] {
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

        const caseSensitive = isCaseSensitive(caseSensitiveInput, conjunct.field);

        if (conjunct.operator === FilterFieldOperator.EQUAL) {
            if (isScopableValue(conjunct.value, caseSensitive)) {
                output.push(buildScopedTag(name, details.name, conjunct.value));
            }

            continue;
        }

        if (
            conjunct.operator === FilterFieldOperator.IN &&
            Array.isArray(conjunct.value) &&
            conjunct.value.length > 0 &&
            conjunct.value.every((value) => isScopableValue(value, caseSensitive))
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
 * implied by a dotted filter, sort or field key, or by a filter applied to
 * a relation itself (`elemMatch`).
 */
function collectRelationPaths(registry: SchemaRegistry, root: Schema, query: IQuery) : string[] {
    const output : string[] = [];

    for (const relation of query.relations.value) {
        output.push(relation.name);
    }

    collectFilterPaths(registry, root, query.filters, output);

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

/**
 * The relation paths a filter tree reaches. A leaf whose key names a
 * relation itself (an operator applied to the relation, `elemMatch`
 * above all) is a terminal name without a dotted path, which the
 * adapters nevertheless join: it is emitted when the registry resolves
 * it, as core's relation obligation for a terminal does. An `elemMatch`
 * interior is addressed relative to its element, so its keys are
 * prefixed with the relation's own path. The interior of an `elemMatch`
 * on a scalar or JSON array joins nothing and is skipped.
 */
function collectFilterPaths(
    registry: SchemaRegistry,
    root: Schema,
    condition: ICondition,
    output: string[],
    prefix = '',
) {
    if (isFilters(condition)) {
        for (const child of condition.value) {
            collectFilterPaths(registry, root, child, output, prefix);
        }

        return;
    }

    if (!isFilter(condition)) {
        return;
    }

    const isElemMatch = condition.operator === FilterFieldOperator.ELEM_MATCH &&
        isCondition(condition.value);

    if (condition.field === ITSELF) {
        if (isElemMatch) {
            collectFilterPaths(registry, root, condition.value as ICondition, output, prefix);
        }

        return;
    }

    const key = prefix ? `${prefix}.${condition.field}` : condition.field;
    pushKeyPath(output, key);

    if (!isRelationPath(registry, root, key)) {
        // core accepts an elemMatch on a declared relation whose target
        // schema is not registered and the adapter still joins it: naming no
        // dependency would serve the result stale, so it is refused like an
        // unregistered include.
        if (isElemMatch) {
            assertNoUnregisteredRelation(registry, root, key);
        }

        return;
    }

    output.push(key);

    if (isElemMatch) {
        collectFilterPaths(registry, root, condition.value as ICondition, output, key);
    }
}

function assertNoUnregisteredRelation(registry: SchemaRegistry, root: Schema, key: string) {
    const segments = toIssuePath(key);
    const last = segments.pop();
    if (typeof last === 'undefined') {
        return;
    }

    let current : Schema | undefined = root;
    for (const segment of segments) {
        current = registry.get(current.mapSchema(segment));
        if (typeof current === 'undefined') {
            return;
        }
    }

    const { allowed } = current.relations;
    if (Array.isArray(allowed) && (allowed as string[]).includes(last)) {
        throw CacheError.relationUnresolvable(resolveSchemaName(current), last);
    }
}

/**
 * Whether every segment of a key maps onto a registered schema. Never
 * throws: a key ending on a column is simply no relation.
 */
function isRelationPath(registry: SchemaRegistry, root: Schema, key: string) : boolean {
    let current = root;
    for (const segment of toIssuePath(key)) {
        const next = registry.get(current.mapSchema(segment));
        if (typeof next === 'undefined') {
            return false;
        }

        current = next;
    }

    return true;
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
