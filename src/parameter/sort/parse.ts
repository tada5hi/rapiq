/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ObjectLiteral } from '../../type';
import {
    applyMapping,
    buildFieldWithPath, flattenNestedObject,
    getFieldDetails,
    hasOwnProperty, isFieldNonRelational,
    isFieldPathAllowedByRelations,
} from '../../utils';
import { flattenParseOptionsAllowed, isPathCoveredByParseOptionsAllowed } from '../utils';

import {
    SortParseOptions,
    SortParseOutput,
    SortParseOutputElement,
} from './type';
import { parseSortValue } from './utils';

// --------------------------------------------------

function isMultiDimensionalArray(arr: unknown) : arr is unknown[][] {
    if (!Array.isArray(arr)) {
        return false;
    }

    return arr.length > 0 && Array.isArray(arr[0]);
}

function buildDefaultSortParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    options: SortParseOptions<T>,
) : SortParseOutput {
    if (options.default) {
        const output : SortParseOutput = [];

        const flatten = flattenNestedObject(options.default);
        const keys = Object.keys(flatten);

        for (let i = 0; i < keys.length; i++) {
            const fieldDetails = getFieldDetails(keys[i]);

            output.push({
                key: fieldDetails.name,
                ...(fieldDetails.path ? { alias: fieldDetails.path } : {}),
                value: flatten[keys[i]],
            });
        }

        return output;
    }

    return [];
}

/**
 * Transform sort data to appreciate data format.
 * @param data
 * @param options
 */
export function parseQuerySort<T extends ObjectLiteral = ObjectLiteral>(
    data: unknown,
    options?: SortParseOptions<T>,
) : SortParseOutput {
    options = options ?? {};

    // If it is an empty array nothing is allowed
    if (
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return [];
    }

    options.mapping = options.mapping || {};

    const prototype = Object.prototype.toString.call(data);

    /* istanbul ignore next */
    if (
        prototype !== '[object String]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object Object]'
    ) {
        return buildDefaultSortParseOutput(options);
    }

    let parts : string[] = [];

    if (typeof data === 'string') {
        parts = data.split(',');
    }

    if (Array.isArray(data)) {
        parts = data.filter((item) => typeof item === 'string');
    }

    if (
        typeof data === 'object' &&
        data !== null
    ) {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            /* istanbul ignore next */
            if (
                !hasOwnProperty(data, keys[i]) ||
                typeof keys[i] !== 'string' ||
                typeof data[keys[i]] !== 'string'
            ) continue;

            const fieldPrefix = (data[keys[i]] as string)
                .toLowerCase() === 'desc' ? '-' : '';

            parts.push(fieldPrefix + keys[i]);
        }
    }

    const items : Record<string, SortParseOutputElement> = {};

    let matched = false;

    for (let i = 0; i < parts.length; i++) {
        const { value, direction } = parseSortValue(parts[i]);
        parts[i] = value;

        const key: string = applyMapping(parts[i], options.mapping);

        const fieldDetails = getFieldDetails(key);
        if (
            !isFieldPathAllowedByRelations(fieldDetails, options.relations) &&
            !isFieldNonRelational(fieldDetails)
        ) {
            continue;
        }

        const keyWithAlias : string = buildFieldWithPath(fieldDetails);

        if (
            typeof options.allowed !== 'undefined' &&
            !isMultiDimensionalArray(options.allowed) &&
            !isPathCoveredByParseOptionsAllowed(options.allowed, [key, keyWithAlias])
        ) {
            continue;
        }

        matched = true;

        let path : string | undefined;
        if (fieldDetails.path) {
            path = fieldDetails.path;
        } else if (options.defaultPath) {
            path = options.defaultPath;
        }

        items[keyWithAlias] = {
            key: fieldDetails.name,
            ...(path ? { path } : {}),
            value: direction,
        };
    }

    if (!matched) {
        return buildDefaultSortParseOutput(options);
    }

    if (isMultiDimensionalArray(options.allowed)) {
        // eslint-disable-next-line no-labels,no-restricted-syntax
        outerLoop:
        for (let i = 0; i < options.allowed.length; i++) {
            const temp : SortParseOutput = [];

            const keyPaths = flattenParseOptionsAllowed(options.allowed[i]);

            for (let j = 0; j < keyPaths.length; j++) {
                const keyWithAlias : string = keyPaths[j];
                const key : string = keyWithAlias.includes('.') ?
                    keyWithAlias.split('.').pop() :
                    keyWithAlias;

                if (
                    hasOwnProperty(items, key) ||
                    hasOwnProperty(items, keyWithAlias)
                ) {
                    const item = hasOwnProperty(items, key) ?
                        items[key] :
                        items[keyWithAlias];

                    temp.push(item);
                } else {
                    // eslint-disable-next-line no-labels
                    continue outerLoop;
                }
            }

            return temp;
        }

        // if we get no match, the sort data is invalid.
        return [];
    }

    return Object.values(items);
}
