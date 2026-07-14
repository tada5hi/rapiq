/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationAliasFn } from '../../helpers';
import type { ISubAdapter } from '../types';

export interface IRelationsAdapter extends ISubAdapter {
    add(input: string): void;

    buildAlias(path: string): string;
}

export type JoinRelationFn = (
    relation: string,
    alias?: string,
) => boolean;

export type RelationsAdapterBaseOptions = {
    /**
     * Join and select relations.
     */
    joinAndSelect?: boolean,

    /**
     * Derive the join alias for a relation path
     * (e.g. `role.realm` -> `r4_role_5_realm`).
     * Field references in filters/sort/fields resolve against the
     * same derivation, so it must be injected once, on the relations
     * adapter shared by all sub-adapters.
     */
    relationAlias?: RelationAliasFn
};

export type RelationsAdapterOptions = RelationsAdapterBaseOptions & {
    join?: JoinRelationFn,

};
