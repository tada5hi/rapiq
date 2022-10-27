/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsParseOutput,
    FiltersParseOutput,
    PaginationParseOutput,
    RelationsParseOutput,
    SortParseOutput,
} from '../parameter';
import { Parameter, URLParameter } from '../constants';
import { ObjectLiteral } from '../type';
import { parseQueryParameter } from './parameter';
import { ParseInput, ParseOptions, ParseOutput } from './type';

export function parseQuery<T extends ObjectLiteral = ObjectLiteral>(
    input: ParseInput,
    options?: ParseOptions<T>,
) : ParseOutput {
    options ??= {};

    const mergeWithGlobalOptions = <T extends {[key: string]: any} & {defaultPath?: string} >(data?: T) : T => {
        if (typeof data !== 'undefined') {
            if (options.defaultPath) {
                data.defaultPath = options.defaultPath;
            }
        }

        return data;
    };

    const output : ParseOutput = {};
    if (options.defaultPath) {
        output.defaultPath = options.defaultPath;
    }

    let relations : RelationsParseOutput | undefined;

    const keys : Parameter[] = [
        // relations must be first parameter
        Parameter.RELATIONS,

        Parameter.FIELDS,
        Parameter.FILTERS,
        Parameter.PAGINATION,
        Parameter.SORT,
    ];

    for (let i = 0; i < keys.length; i++) {
        const key : Parameter = keys[i];

        switch (key) {
            case Parameter.RELATIONS: {
                const value = input[Parameter.RELATIONS] ?? input[URLParameter.RELATIONS];
                if (value || options[Parameter.RELATIONS]) {
                    relations = parseQueryParameter(
                        key,
                        value,
                        options[Parameter.RELATIONS],
                    );

                    output[Parameter.RELATIONS] = relations;
                }
                break;
            }
            case Parameter.FIELDS: {
                const value = input[Parameter.FIELDS] ?? input[URLParameter.FIELDS];
                if (value || options[Parameter.FIELDS]) {
                    output[Parameter.FIELDS] = parseQueryParameter(
                        key,
                        value,
                        mergeWithGlobalOptions(options[Parameter.FIELDS]),
                        relations,
                    ) as FieldsParseOutput;
                }
                break;
            }
            case Parameter.FILTERS: {
                const value = input[Parameter.FILTERS] ?? input[URLParameter.FILTERS];
                if (value || options[Parameter.FILTERS]) {
                    output[Parameter.FILTERS] = parseQueryParameter(
                        key,
                        value,
                        mergeWithGlobalOptions(options[Parameter.FILTERS]),
                        relations,
                    ) as FiltersParseOutput;
                }
                break;
            }
            case Parameter.PAGINATION: {
                const value = input[Parameter.PAGINATION] ?? input[URLParameter.PAGINATION];
                if (value || options[Parameter.PAGINATION]) {
                    output[Parameter.PAGINATION] = parseQueryParameter(
                        key,
                        value,
                        options[Parameter.PAGINATION],
                        relations,
                    ) as PaginationParseOutput;
                }
                break;
            }
            case Parameter.SORT: {
                const value = input[Parameter.SORT] ?? input[URLParameter.SORT];
                if (value || options[Parameter.SORT]) {
                    output[Parameter.SORT] = parseQueryParameter(
                        key,
                        value,
                        mergeWithGlobalOptions(options[Parameter.SORT]),
                        relations,
                    ) as SortParseOutput;
                }
                break;
            }
        }
    }

    return output;
}
