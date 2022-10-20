/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ObjectLiteral } from '../../type';
import {
    FieldDetails,
    applyMapping,
    buildFieldWithPath,
    flattenNestedObject,
    getFieldDetails,
    hasOwnProperty, isFieldNonRelational, isFieldPathAllowedByRelations,
} from '../../utils';
import { isPathCoveredByParseOptionsAllowed } from '../utils';
import { FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement } from './type';
import { determineFilterOperatorLabelsByValue, transformFilterValue } from './utils';

// --------------------------------------------------

function transformFiltersParseOutputElement(element: FiltersParseOutputElement) : FiltersParseOutputElement {
    if (
        hasOwnProperty(element, 'path') &&
        (
            typeof element.path === 'undefined' ||
            element.path === null
        )
    ) {
        delete element.path;
    }

    if (typeof element.value === 'string') {
        const { value, operators } = determineFilterOperatorLabelsByValue(element.value);
        if (operators.length > 0) {
            element.value = value;
            element.operator = {};

            for (let i = 0; i < operators.length; i++) {
                element.operator[operators[i]] = true;
            }
        }
    }

    element.value = transformFilterValue(element.value);

    return element;
}

function transformFiltersParseOutput(output: FiltersParseOutput) {
    for (let i = 0; i < output.length; i++) {
        output[i] = transformFiltersParseOutputElement(output[i]);
    }

    return output;
}

function buildDefaultFiltersParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    options: FiltersParseOptions<T>,
    input?: Record<string, FiltersParseOutputElement>,
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
    options = options ?? {};
    options.mapping = options.mapping || {};
    options.relations = options.relations || [];

    // If it is an empty array nothing is allowed
    if (
        typeof options.allowed === 'undefined' ||
        options.allowed.length === 0
    ) {
        return [];
    }

    /* istanbul ignore next */
    if (typeof data !== 'object' || data === null) {
        return transformFiltersParseOutput(
            buildDefaultFiltersParseOutput(options),
        );
    }

    const { length } = Object.keys(data);
    if (length === 0) {
        return transformFiltersParseOutput(
            buildDefaultFiltersParseOutput(options),
        );
    }

    const temp : Record<string, FiltersParseOutputElement> = {};

    // transform to appreciate data format & validate input
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        /* istanbul ignore next */
        if (!hasOwnProperty(data, keys[i])) {
            // eslint-disable-next-line no-continue
            continue;
        }

        let value : unknown = data[keys[i]];

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            value !== null
        ) {
            // eslint-disable-next-line no-continue
            continue;
        }

        if (typeof value === 'string') {
            value = value.trim();
            const stripped : string = (value as string).replace('/,/g', '');
            if (stripped.length === 0) {
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        keys[i] = applyMapping(keys[i], options.mapping);

        const fieldDetails : FieldDetails = getFieldDetails(keys[i]);

        if (
            !isFieldPathAllowedByRelations(fieldDetails, options.relations) &&
            !isFieldNonRelational(fieldDetails)
        ) {
            continue;
        }

        const fullKey : string = buildFieldWithPath(fieldDetails);

        if (
            options.allowed &&
            !isPathCoveredByParseOptionsAllowed(options.allowed, [keys[i], fullKey])
        ) {
            continue;
        }

        let path : string | undefined;
        if (fieldDetails.path) {
            path = fieldDetails.path;
        } else if (options.defaultPath) {
            path = options.defaultPath;
        }

        temp[fullKey] = {
            ...(path ? { path } : {}),
            key: fieldDetails.name,
            value: value as string | boolean | number,
        };
    }

    return transformFiltersParseOutput(
        buildDefaultFiltersParseOutput(options, temp),
    );
}
