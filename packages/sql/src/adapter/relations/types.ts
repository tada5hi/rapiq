/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAdapter } from '../types';

export interface IRelationsAdapter<
QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
    add(input: string): void;
}

export type JoinRelationFn<
    QUERY extends Record<string, any> = Record<string, any>,
> = (
    relation: string,
    alias?: string,
    query?: QUERY
) => boolean;

export type RelationsAdapterBaseOptions = {
    /**
     * Join and select relations.
     */
    joinAndSelect?: boolean
};

export type RelationsAdapterOptions<
    QUERY extends Record<string, any> = Record<string, any>,
> = RelationsAdapterBaseOptions & {
    join?: JoinRelationFn<QUERY>,

};
