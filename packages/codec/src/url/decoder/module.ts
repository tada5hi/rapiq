/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { parse } from 'qs';
import type {
    Condition,
    Query,
} from 'rapiq';
import { SimpleFiltersParser, URLParameter, isObject } from 'rapiq';

export class URLDecoder {
    protected filters : SimpleFiltersParser;

    constructor() {
        this.filters = new SimpleFiltersParser();
    }

    async decode(input: string) : Promise<Query | null> {
        const parsed = parse(input);
        if (!isObject(parsed)) {
            return null;
        }

        const output : Query = {};

        if (parsed[URLParameter.FILTERS]) {
            output.filters = await this.filters.parse(output);
        }

        return output;
    }

    async decodeFilters(input: string) : Promise<Condition | null> {
        const output = parse(input);
        if (!isObject(output)) {
            return null;
        }

        if (output[URLParameter.FILTERS]) {
            if (isObject(output[URLParameter.FILTERS])) {
                return this.filters.parse(output[URLParameter.FILTERS]);
            }

            return null;
        }

        return this.filters.parse(output);
    }
}
