/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    buildFieldWithAlias,
    buildObjectFromStringArray,
    getFieldDetails, getNameByAliasMapping, hasOwnProperty,
    isAllowedByRelations,
} from '../../utils';

import {
    SortDirection, SortParseOptions, SortParseOutput, SortParseOutputElement,
} from './type';

// --------------------------------------------------

function isMultiDimensionalArray(arr: unknown) : arr is unknown[][] {
    if (!Array.isArray(arr)) {
        return false;
    }

    return arr.length > 0 && Array.isArray(arr[0]);
}

function buildDefaultSortParseOutput(options: SortParseOptions) : SortParseOutput {
    if (options.default) {
        const keys = Object.keys(options.default);

        const output : SortParseOutput = [];

        for (let i = 0; i < keys.length; i++) {
            const fieldDetails = getFieldDetails(keys[i], options.defaultAlias);

            output.push({
                key: fieldDetails.name,
                ...(fieldDetails.alias ? { alias: fieldDetails.alias } : {}),
                value: options.default[keys[i]],
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
export function parseQuerySort(
    data: unknown,
    options?: SortParseOptions,
) : SortParseOutput {
    options = options ?? {};

    // If it is an empty array nothing is allowed
    if (
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return [];
    }

    options.aliasMapping = options.aliasMapping ? buildObjectFromStringArray(options.aliasMapping) : {};

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
        let direction: SortDirection = SortDirection.ASC;
        if (parts[i].substring(0, 1) === '-') {
            direction = SortDirection.DESC;
            parts[i] = parts[i].substring(1);
        }

        const key: string = getNameByAliasMapping(parts[i], options.aliasMapping);

        const fieldDetails = getFieldDetails(key, options.defaultAlias);
        if (!isAllowedByRelations(fieldDetails, options.relations, options.defaultAlias)) {
            continue;
        }

        const keyWithAlias : string = buildFieldWithAlias(fieldDetails, options.defaultAlias);

        if (
            typeof options.allowed !== 'undefined' &&
            !isMultiDimensionalArray(options.allowed) &&
            options.allowed.indexOf(key) === -1 &&
            options.allowed.indexOf(keyWithAlias) === -1
        ) {
            continue;
        }

        matched = true;

        items[keyWithAlias] = {
            key: fieldDetails.name,
            ...(fieldDetails.alias ? { alias: fieldDetails.alias } : {}),
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

            for (let j = 0; j < options.allowed[i].length; j++) {
                const keyWithAlias : string = options.allowed[i][j];
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
