/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import type { EntityMetadata } from 'typeorm';
import type { ITaggedCache } from '../types';

export type CacheInvalidationSubscriberOptions = {
    cache: Pick<ITaggedCache, 'invalidate'>,
    /**
     * The registry the reading side derives its tags from: the scoped tags a
     * written row bumps come from the same `indexes` declaration.
     */
    registry: SchemaRegistry,
    /**
     * The rapiq schema name of an entity, or `undefined` for a table the
     * cache does not track.
     */
    resolveSchemaName: (metadata: EntityMetadata) => string | undefined,
    /**
     * Where a failed bump is reported. Default: dropped. A hook never
     * rethrows, since a failure there would fail the request after its
     * write committed.
     */
    onError?: (error: unknown) => void,
};
