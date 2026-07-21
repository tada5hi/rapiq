/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SimpleResourceKeys } from '../../../types';
import type { BaseSchemaOptions, KeyValidator } from '../../types';

export type RelationsOptions<
    T extends Record<string, any> = Record<string, any>,
    CONTEXT = any,
> = BaseSchemaOptions & {
    allowed?: SimpleResourceKeys<T>[],
    includeParents?: boolean | string[] | string,
    // maps input name to local name
    mapping?: Record<string, string>,
    // set alternate value for relation key.
    pathMapping?: Record<string, string>,
    /**
     * Dynamic per-relation gate, e.g. an actor permission check.
     * Runs on the canonical relation name relative to this schema —
     * `include=client.realm` invokes the root schema's hook with
     * `client` and the client schema's hook with `realm`. Rejecting
     * a relation also drops every deeper relation reached through it.
     */
    validate?: KeyValidator<CONTEXT>,
};
