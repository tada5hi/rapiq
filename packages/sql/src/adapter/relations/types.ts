/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationAliasFn } from '../../helpers';
import type { ISubAdapter } from '../types';

export type RelationAddOptions = {
    /**
     * Whether the relation was explicitly requested (`include`/`relations`)
     * rather than only traversed by a field/filter/sort path. Explicit
     * includes are hydrated by backends that materialize an object graph
     * (e.g. `@rapiq/typeorm`), a join-for-filter is not.
     */
    include?: boolean,
};

export interface IRelationsAdapter extends ISubAdapter {
    add(input: string, options?: RelationAddOptions): void;

    buildAlias(path: string): string;

    isRelationPath(path: string): boolean;
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
