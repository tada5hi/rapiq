/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISubAdapter } from '../types';

export interface IRelationsAdapter<
    TARGET extends Record<string, any> = Record<string, any>,
> extends ISubAdapter<TARGET> {
    add(input: string): void;
}

export type JoinRelationFn<
    TARGET extends Record<string, any> = Record<string, any>,
> = (
    relation: string,
    alias?: string,
    target?: TARGET,
) => boolean;

export type RelationsAdapterBaseOptions = {
    /**
     * Join and select relations.
     */
    joinAndSelect?: boolean
};

export type RelationsAdapterOptions<
    TARGET extends Record<string, any> = Record<string, any>,
> = RelationsAdapterBaseOptions & {
    join?: JoinRelationFn<TARGET>,

};
