/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SimpleFiltersParser } from '@rapiq/parser-simple';
import { parse } from 'qs';
import type { Condition } from 'rapiq';
import {
    Query,
    isObject,
} from 'rapiq';
import { URLParameter } from '../constants';

export class URLDecoder {
    protected filters : SimpleFiltersParser;

    constructor() {
        this.filters = new SimpleFiltersParser();
    }

    decode(input: string) : Query | null {
        const parsed = parse(input);
        if (!isObject(parsed)) {
            return null;
        }

        const output = new Query();

        if (parsed[URLParameter.FILTERS]) {
            output.filters = this.filters.parse(output);
        }

        return output;
    }

    decodeFilters(input: string) : Condition | null {
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
