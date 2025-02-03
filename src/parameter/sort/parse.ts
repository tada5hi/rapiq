/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import type { ObjectLiteral } from '../../type';
import {
    applyMapping,
    buildKeyPath,
    buildKeyWithPath,
    hasOwnProperty,
    isPathAllowedByRelations,
    parseKey,
} from '../../utils';
import { isValidFieldName } from '../fields';
import { flattenParseAllowedOption, isPathCoveredByParseAllowedOption } from '../utils';
import { SortOptionsContainer } from './container';
import { SortParseError } from './errors';

import type {
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

/**
 * Transform sort data to appreciate data format.
 * @param data
 * @param options
 */
export function parseQuerySort<T extends ObjectLiteral = ObjectLiteral>(
    data: unknown,
    options?: SortParseOptions<T> | SortOptionsContainer<T>,
) : SortParseOutput {
    let container : SortOptionsContainer<T>;
    if (options instanceof SortOptionsContainer) {
        container = options;
    } else {
        container = new SortOptionsContainer<T>(options);
    }

    // If it is an empty array nothing is allowed
    if (
        !container.allowedIsUndefined &&
        container.allowed.length === 0
    ) {
        return container.defaultOutput;
    }

    /* istanbul ignore next */
    if (
        typeof data !== 'string' &&
        !Array.isArray(data) &&
        !isObject(data)
    ) {
        if (container.options.throwOnFailure) {
            throw SortParseError.inputInvalid();
        }

        return container.defaultOutput;
    }

    let parts : string[] = [];

    if (typeof data === 'string') {
        parts = data.split(',');
    }

    if (Array.isArray(data)) {
        parts = data.filter((item) => typeof item === 'string');
    }

    if (isObject(data)) {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            /* istanbul ignore next */
            if (
                !hasOwnProperty(data, keys[i]) ||
                typeof keys[i] !== 'string' ||
                typeof data[keys[i]] !== 'string'
            ) {
                if (container.options.throwOnFailure) {
                    throw SortParseError.keyValueInvalid(keys[i]);
                }

                continue;
            }

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

        const key: string = applyMapping(parts[i], container.options.mapping);

        const fieldDetails = parseKey(key);

        if (
            container.allowedIsUndefined &&
            !isValidFieldName(fieldDetails.name)
        ) {
            if (container.options.throwOnFailure) {
                throw SortParseError.keyInvalid(fieldDetails.name);
            }

            continue;
        }

        if (
            !isPathAllowedByRelations(fieldDetails.path, container.options.relations) &&
            typeof fieldDetails.path !== 'undefined'
        ) {
            if (container.options.throwOnFailure) {
                throw SortParseError.keyPathInvalid(fieldDetails.path);
            }

            continue;
        }

        const keyWithAlias = buildKeyWithPath(fieldDetails);
        if (
            !container.allowedIsUndefined &&
            container.allowed &&
            !isMultiDimensionalArray(container.options.allowed) &&
            !isPathCoveredByParseAllowedOption(container.allowed, [key, keyWithAlias])
        ) {
            if (container.options.throwOnFailure) {
                throw SortParseError.keyNotAllowed(fieldDetails.name);
            }

            continue;
        }

        matched = true;

        let path : string | undefined;
        if (fieldDetails.path) {
            path = fieldDetails.path;
        } else if (container.options.defaultPath) {
            path = container.options.defaultPath;
        }

        items[keyWithAlias] = {
            key: fieldDetails.name,
            ...(path ? { path } : {}),
            value: direction,
        };
    }

    if (!matched) {
        return container.defaultOutput;
    }

    if (isMultiDimensionalArray(container.options.allowed)) {
        // eslint-disable-next-line no-labels,no-restricted-syntax
        outerLoop:
        for (let i = 0; i < container.allowed.length; i++) {
            const temp : SortParseOutput = [];

            const keyPaths = flattenParseAllowedOption(container.options.allowed[i] as string[]);

            for (let j = 0; j < keyPaths.length; j++) {
                let keyWithAlias : string = keyPaths[j];
                let key : string;

                const parts = keyWithAlias.split('.');
                if (parts.length > 1) {
                    key = parts.pop() as string;
                } else {
                    key = keyWithAlias;

                    keyWithAlias = buildKeyPath(key, container.options.defaultPath);
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
