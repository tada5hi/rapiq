/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import type { EntityMetadata } from 'typeorm';
import type { ITaggedCache, ScopedTagValueNormalizer } from '../types';

/**
 * A table the cache tracks by name alone, without a rapiq schema: a write
 * bumps its collection tag and its record tag, and the registry is never
 * asked for it (so no scoped tag, and no `schemaUnresolvable` report).
 */
export type CacheInvalidationSchemaTarget = {
    name: string,
    schema: false,
};

export type CacheInvalidationSubscriberOptions = {
    cache: Pick<ITaggedCache, 'invalidate'>,
    /**
     * The registry the reading side derives its tags from: the scoped tags a
     * written row bumps come from the same `indexes` declaration.
     */
    registry: SchemaRegistry,
    /**
     * The rapiq schema name of an entity, or `undefined` for a table the
     * cache does not track. A name the registry lacks is reported to
     * `onError` on every write, so a typo in the mapping stays visible.
     * `{ name, schema: false }` tracks a table deliberately without a
     * schema: its collection and record tags are bumped, and the registry
     * is not consulted.
     */
    resolveSchemaName: (metadata: EntityMetadata) => string | CacheInvalidationSchemaTarget | undefined,
    /**
     * The canonical spelling of every scoped tag value the subscriber
     * bumps (row values old and new, the `null` scope, cascade keys, the
     * latter with the child's schema and column). Hand the reading side
     * (`rememberQuery`, `collectQueryTags`) the same function. A throw, or
     * an answer that is no scoped tag value, is reported to `onError` and
     * the raw value is bumped instead, which does not reach a reader tagged
     * with the canonical spelling (it stays until its ttl): keep the
     * function total. Default: the value as written.
     */
    normalizeScopedValue?: ScopedTagValueNormalizer,
    /**
     * Where a failed bump is reported. Default: dropped. A hook never
     * rethrows, since a failure there would fail the request after its
     * write committed.
     */
    onError?: (error: unknown) => void,
};
