/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    parseQueryFields,
    parseQueryFilters,
    parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
} from '../parameter';
import type {
    RelationsParseOutput,
} from '../parameter';
import { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../type';
import { buildQueryParameterOptions, isQueryParameterEnabled } from './parameter';
import type { ParseInput, ParseOptions, ParseOutput } from './type';

export function parseQuery<T extends ObjectLiteral = ObjectLiteral>(
    input: ParseInput,
    options: ParseOptions<T> = {},
) : ParseOutput {
    options = options || {};

    const mergeWithGlobalOptions = <T extends {
        defaultPath?: string,
        throwOnFailure?: boolean
    }>(data: T) : T => {
        if (typeof data.defaultPath === 'undefined') {
            data.defaultPath = options.defaultPath;
        }

        if (typeof data.throwOnFailure === 'undefined') {
            data.throwOnFailure = options.throwOnFailure;
        }

        return data;
    };

    const output : ParseOutput = {};
    if (options.defaultPath) {
        output.defaultPath = options.defaultPath;
    }

    let relations : RelationsParseOutput | undefined;

    let value = input[Parameter.RELATIONS] || input[URLParameter.RELATIONS];
    if (isQueryParameterEnabled({ data: value, options: options[Parameter.RELATIONS] })) {
        relations = parseQueryRelations(
            value,
            buildQueryParameterOptions(options[Parameter.RELATIONS]),
        );

        output[Parameter.RELATIONS] = relations;
    }

    value = input[Parameter.FIELDS] || input[URLParameter.FIELDS];
    if (isQueryParameterEnabled({ data: value, options: options[Parameter.FIELDS] })) {
        output[Parameter.FIELDS] = parseQueryFields(
            value,
            {
                ...mergeWithGlobalOptions(buildQueryParameterOptions(options[Parameter.FIELDS])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    value = input[Parameter.FILTERS] || input[URLParameter.FILTERS];
    if (isQueryParameterEnabled({ data: value, options: options[Parameter.FILTERS] })) {
        output[Parameter.FILTERS] = parseQueryFilters(
            value,
            {
                ...mergeWithGlobalOptions(buildQueryParameterOptions(options[Parameter.FILTERS])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    value = input[Parameter.PAGINATION] || input[URLParameter.PAGINATION];
    if (isQueryParameterEnabled({ data: value, options: options[Parameter.PAGINATION] })) {
        output[Parameter.PAGINATION] = parseQueryPagination(
            value,
            mergeWithGlobalOptions(buildQueryParameterOptions(options[Parameter.PAGINATION])),
        );
    }

    value = input[Parameter.SORT] || input[URLParameter.SORT];
    if (isQueryParameterEnabled({ data: value, options: options[Parameter.SORT] })) {
        output[Parameter.SORT] = parseQuerySort(
            value,
            {
                ...mergeWithGlobalOptions(buildQueryParameterOptions(options[Parameter.SORT])),
                ...(relations ? { relations } : {}),
            },
        );
    }

    return output;
}
