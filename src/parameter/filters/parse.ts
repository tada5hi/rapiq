/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { NestedKeys, ObjectLiteral } from '../../type';
import {
    FieldDetails,
    applyMapping,
    buildFieldWithPath,
    flattenNestedObject,
    getFieldDetails,
    hasOwnProperty, isFieldNonRelational, isFieldPathAllowedByRelations,
} from '../../utils';
import { isValidFieldName } from '../fields';
import { ParseAllowedOption } from '../type';
import { flattenParseAllowedOption, isPathCoveredByParseAllowedOption } from '../utils';
import { FilterComparisonOperator } from './constants';
import { FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement } from './type';
import { parseFilterValue, transformFilterValue } from './utils';

// --------------------------------------------------

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
            const fieldDetails = getFieldDetails(keys[i]);

            if (
                options.defaultByElement &&
                inputKeys.length > 0
            ) {
                const fieldWithAlias = buildFieldWithPath(fieldDetails);
                if (hasOwnProperty(input, fieldWithAlias)) {
                    continue;
                }
            }

            if (options.defaultByElement || inputKeys.length === 0) {
                let path : string | undefined;
                if (fieldDetails.path) {
                    path = fieldDetails.path;
                } else if (options.defaultPath) {
                    path = options.defaultPath;
                }

                output.push(transformFiltersParseOutputElement({
                    ...(path ? { path } : {}),
                    key: fieldDetails.name,
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
    if (typeof data !== 'object' || data === null) {
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
        /* istanbul ignore next */
        if (!hasOwnProperty(data, keys[i])) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const value : unknown = data[keys[i]];

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            typeof value !== 'undefined' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            continue;
        }

        keys[i] = applyMapping(keys[i], options.mapping);

        const fieldDetails : FieldDetails = getFieldDetails(keys[i]);

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

        const fullKey : string = buildFieldWithPath(fieldDetails);

        if (
            options.allowed &&
            !isPathCoveredByParseAllowedOption(options.allowed, [keys[i], fullKey])
        ) {
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
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!options.validate(filter.key as NestedKeys<T>, filter.value)) {
                continue;
            }
        }

        if (
            typeof filter.value === 'string' &&
            filter.value.length === 0
        ) {
            continue;
        }

        if (
            Array.isArray(filter.value) &&
            filter.value.length === 0
        ) {
            continue;
        }

        if (fieldDetails.path || options.defaultPath) {
            filter.path = fieldDetails.path || options.defaultPath;
        }

        items[fullKey] = filter;
    }

    return buildDefaultFiltersParseOutput(options, items);
}
