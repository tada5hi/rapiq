/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AbstractRelationsContainer } from './base';

export type JoinRelationFn<
    QUERY extends Record<string, any> = Record<string, any>,
> = (
    relation: string,
    alias?: string,
    query?: QUERY
) => boolean;

export type QueryRelationsOptions<
    QUERY extends Record<string, any> = Record<string, any>,
> = {
    join: JoinRelationFn<QUERY>
};

export class RelationsContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> extends AbstractRelationsContainer<QUERY> {
    protected options : QueryRelationsOptions<QUERY>;

    // -----------------------------------------------------------

    constructor(options: QueryRelationsOptions<QUERY>) {
        super();

        this.options = options;
    }

    // -----------------------------------------------------------

    join(_relation: string, _rootAlias?: string) : boolean {
        return this.options.join(_relation, _rootAlias, this.query);
    }
}
