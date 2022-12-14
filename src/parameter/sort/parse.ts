/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ObjectLiteral } from '../../type';
import {
    applyMapping,
    buildFieldWithPath, buildKeyPath, flattenNestedObject,
    getFieldDetails,
    hasOwnProperty, isFieldNonRelational,
    isFieldPathAllowedByRelations,
} from '../../utils';
import { isValidFieldName } from '../fields';
import { ParseAllowedOption } from '../type';
import { flattenParseAllowedOption, isPathCoveredByParseAllowedOption } from '../utils';

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

            let path : string | undefined;
            if (fieldDetails.path) {
                path = fieldDetails.path;
            } else if (options.defaultPath) {
                path = options.defaultPath;
            }

            output.push({
                key: fieldDetails.name,
                ...(path ? { path } : {}),
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
    if (typeof options.allowed !== 'undefined') {
        const allowed = flattenParseAllowedOption(options.allowed) as ParseAllowedOption<T>;
        if (allowed.length === 0) {
            return buildDefaultSortParseOutput(options);
        }
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

    if (
        typeof options.allowed === 'undefined' &&
        options.default
    ) {
        const flatten = flattenNestedObject(options.default);
        options.allowed = Object.keys(flatten) as ParseAllowedOption<T>;
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
            typeof options.allowed === 'undefined' &&
            !isValidFieldName(fieldDetails.name)
        ) {
            continue;
        }

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
            !isPathCoveredByParseAllowedOption(options.allowed, [key, keyWithAlias])
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

            const keyPaths = flattenParseAllowedOption(options.allowed[i]);

            for (let j = 0; j < keyPaths.length; j++) {
                let keyWithAlias : string = keyPaths[j];
                let key : string;

                const parts = keyWithAlias.split('.');
                if (parts.length > 1) {
                    key = parts.pop();
                } else {
                    key = keyWithAlias;

                    keyWithAlias = buildKeyPath(key, options.defaultPath);
                }

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
