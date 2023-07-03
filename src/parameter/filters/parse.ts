/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedKeys, ObjectLiteral } from '../../type';
import type { KeyDetails } from '../../utils';
import {
    applyMapping,
    buildKeyWithPath,
    flattenNestedObject,
    hasOwnProperty,
    isObject,
    isPathAllowedByRelations,
    parseKey,
} from '../../utils';
import { isValidFieldName } from '../fields';
import type { ParseAllowedOption } from '../type';
import { flattenParseAllowedOption, isPathCoveredByParseAllowedOption } from '../utils';
import { FilterComparisonOperator } from './constants';
import { FiltersParseError } from './errors';
import type { FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement } from './type';
import { parseFilterValue, transformFilterValue } from './utils';

// --------------------------------------------------
// ^([0-9]+(?:\.[0-9]+)*){0,1}([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*){0,1}$
function transformFiltersParseOutputElement(element: FiltersParseOutputElement) : FiltersParseOutputElement {
    if (
        hasOwnProperty(element, 'path') &&
        (typeof element.path === 'undefined' || element.path === null)
    ) {
        delete element.path;
    }

    if (element.operator) {
        return element;
    }

    if (typeof element.value === 'string') {
        element = {
            ...element,
            ...parseFilterValue(element.value),
        };
    } else {
        element.operator = FilterComparisonOperator.EQUAL;
    }

    element.value = transformFilterValue(element.value);

    return element;
}

function buildDefaultFiltersParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    options: FiltersParseOptions<T>,
    input: Record<string, FiltersParseOutputElement> = {},
) : FiltersParseOutput {
    const inputKeys = Object.keys(input || {});

    if (
        !options.defaultByElement &&
        inputKeys.length > 0
    ) {
        return Object.values(input);
    }

    if (options.default) {
        const flatten = flattenNestedObject(options.default);
        const keys = Object.keys(flatten);

        const output : FiltersParseOutput = [];

        for (let i = 0; i < keys.length; i++) {
            const keyDetails = parseKey(keys[i]);

            if (
                options.defaultByElement &&
                inputKeys.length > 0
            ) {
                const keyWithPath = buildKeyWithPath(keyDetails);
                if (hasOwnProperty(input, keyWithPath)) {
                    continue;
                }
            }

            if (options.defaultByElement || inputKeys.length === 0) {
                let path : string | undefined;
                if (keyDetails.path) {
                    path = keyDetails.path;
                } else if (options.defaultPath) {
                    path = options.defaultPath;
                }

                output.push(transformFiltersParseOutputElement({
                    ...(path ? { path } : {}),
                    key: keyDetails.name,
                    value: flatten[keys[i]],
                }));
            }
        }

        return input ? [...Object.values(input), ...output] : output;
    }

    return input ? Object.values(input) : [];
}

export function parseQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    data: unknown,
    options?: FiltersParseOptions<T>,
) : FiltersParseOutput {
    options = options || {};
    options.mapping = options.mapping || {};
    options.relations = options.relations || [];

    // If it is an empty array nothing is allowed
    if (typeof options.allowed !== 'undefined') {
        options.allowed = flattenParseAllowedOption(options.allowed) as ParseAllowedOption<T>;
        if (options.allowed.length === 0) {
            return buildDefaultFiltersParseOutput(options);
        }
    }

    /* istanbul ignore next */
    if (!isObject(data)) {
        if (options.throwOnError) {
            throw FiltersParseError.inputInvalid();
        }

        return buildDefaultFiltersParseOutput(options);
    }

    const { length } = Object.keys(data);
    if (length === 0) {
        return buildDefaultFiltersParseOutput(options);
    }

    if (
        (typeof options.allowed === 'undefined' || options.allowed.length === 0) &&
        options.default
    ) {
        const flatten = flattenNestedObject(options.default);
        options.allowed = Object.keys(flatten) as ParseAllowedOption<T>;
    }

    const items : Record<string, FiltersParseOutputElement> = {};

    // transform to appreciate data format & validate input
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        const value : unknown = data[keys[i]];

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            typeof value !== 'undefined' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyValueInvalid(keys[i]);
            }
            continue;
        }

        keys[i] = applyMapping(keys[i], options.mapping);

        const fieldDetails : KeyDetails = parseKey(keys[i]);

        if (
            typeof options.allowed === 'undefined' &&
            !isValidFieldName(fieldDetails.name)
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyInvalid(fieldDetails.name);
            }
            continue;
        }

        if (
            typeof fieldDetails.path !== 'undefined' &&
            !isPathAllowedByRelations(fieldDetails.path, options.relations)
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyPathInvalid(fieldDetails.path);
            }
            continue;
        }

        const fullKey : string = buildKeyWithPath(fieldDetails);

        if (
            options.allowed &&
            !isPathCoveredByParseAllowedOption(options.allowed, [keys[i], fullKey])
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyInvalid(fieldDetails.name);
            }

            continue;
        }

        const filter = transformFiltersParseOutputElement({
            key: fieldDetails.name,
            value: value as string | boolean | number,
        });

        if (options.validate) {
            if (Array.isArray(filter.value)) {
                const output : (string | number)[] = [];
                for (let j = 0; j < filter.value.length; j++) {
                    if (options.validate(filter.key as NestedKeys<T>, filter.value[j])) {
                        output.push(filter.value[j]);
                    } else if (options.throwOnError) {
                        throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!options.validate(filter.key as NestedKeys<T>, filter.value)) {
                if (options.throwOnError) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }
        }

        if (
            typeof filter.value === 'string' &&
            filter.value.length === 0
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyValueInvalid(fieldDetails.name);
            }

            continue;
        }

        if (
            Array.isArray(filter.value) &&
            filter.value.length === 0
        ) {
            if (options.throwOnError) {
                throw FiltersParseError.keyValueInvalid(fieldDetails.name);
            }

            continue;
        }

        if (fieldDetails.path || options.defaultPath) {
            filter.path = fieldDetails.path || options.defaultPath;
        }

        items[fullKey] = filter;
    }

    return buildDefaultFiltersParseOutput(options, items);
}
