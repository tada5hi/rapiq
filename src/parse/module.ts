/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsParseOutput, FiltersParseOutput, PaginationParseOutput, RelationsParseOutput, SortParseOutput,
} from '../parameter';
import { Parameter, URLParameter } from '../constants';
import { parseQueryParameter } from './parameter';
import { ParseInput, ParseOptions, ParseOutput } from './type';

export function parseQuery(
    input: ParseInput,
    options?: ParseOptions,
) : ParseOutput {
    options ??= {};

    const output : ParseOutput = {};

    const nonEnabled : boolean = Object.keys(options).length === 0;

    let relations : RelationsParseOutput | undefined;
    if (!!options[Parameter.RELATIONS] || nonEnabled) {
        relations = parseQueryParameter(
            Parameter.RELATIONS,
            input[Parameter.RELATIONS] ?? input[URLParameter.RELATIONS],
            options[Parameter.RELATIONS],
        );

        output[Parameter.RELATIONS] = relations;
    }

    const keys : Parameter[] = [
        Parameter.FIELDS,
        Parameter.FILTERS,
        Parameter.PAGINATION,
        Parameter.SORT,
    ];

    for (let i = 0; i < keys.length; i++) {
        const enabled = !!options[keys[i]] ||
            nonEnabled;

        if (!enabled) continue;

        const key : Parameter = keys[i];

        switch (key) {
            case Parameter.FIELDS:
                output[Parameter.FIELDS] = parseQueryParameter(
                    keys[i],
                    input[Parameter.FIELDS] ?? input[URLParameter.FIELDS],
                    options[Parameter.FIELDS],
                    relations,
                ) as FieldsParseOutput;
                break;
            case Parameter.FILTERS:
                output[Parameter.FILTERS] = parseQueryParameter(
                    keys[i],
                    input[Parameter.FILTERS] ?? input[URLParameter.FILTERS],
                    options[Parameter.FILTERS],
                    relations,
                ) as FiltersParseOutput;
                break;
            case Parameter.PAGINATION:
                output[Parameter.PAGINATION] = parseQueryParameter(
                    keys[i],
                    input[Parameter.PAGINATION] ?? input[URLParameter.PAGINATION],
                    options[Parameter.PAGINATION],
                    relations,
                ) as PaginationParseOutput;
                break;
            case Parameter.SORT:
                output[Parameter.SORT] = parseQueryParameter(
                    keys[i],
                    input[Parameter.SORT] ?? input[URLParameter.SORT],
                    options[Parameter.SORT],
                    relations,
                ) as SortParseOutput;
                break;
        }
    }

    return output;
}
