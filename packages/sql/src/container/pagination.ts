/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class PaginationContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> {
    public limit : number | undefined;

    public offset : number | undefined;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    withQuery(query?: QUERY): PaginationContainer<QUERY> {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    setLimit(limit?: number) {
        this.limit = limit;
    }

    setOffset(offset?: number) {
        this.offset = offset;
    }

    // -----------------------------------------------------------

    apply() {

    }
}
