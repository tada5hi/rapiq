/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IPaginationAdapter } from './types';

export abstract class PaginationBaseAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements IPaginationAdapter<QUERY> {
    public limit : number | undefined;

    public offset : number | undefined;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    withQuery(query?: QUERY): PaginationBaseAdapter<QUERY> {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    clear() {
        this.limit = undefined;
        this.offset = undefined;
    }

    // -----------------------------------------------------------

    setLimit(limit?: number) {
        this.limit = limit;
    }

    setOffset(offset?: number) {
        this.offset = offset;
    }

    // -----------------------------------------------------------

    abstract execute() : void;
}
