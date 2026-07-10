/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISubAdapter } from '../types';

export interface IRelationsAdapter extends ISubAdapter {
    add(input: string): void;
}

export type JoinRelationFn = (
    relation: string,
    alias?: string,
) => boolean;

export type RelationsAdapterBaseOptions = {
    /**
     * Join and select relations.
     */
    joinAndSelect?: boolean
};

export type RelationsAdapterOptions = RelationsAdapterBaseOptions & {
    join?: JoinRelationFn,

};
