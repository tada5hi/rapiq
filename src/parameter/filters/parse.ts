/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import minimatch from 'minimatch';
import {
    FieldDetails,
    buildFieldWithAlias,
    buildObjectFromStringArray,
    getFieldDetails,
    getNameByAliasMapping,
    hasOwnProperty,
    isAllowedByRelations,
} from '../../utils';
import { FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement } from './type';
import { determineFilterOperatorLabelsByValue, transformFilterValue } from './utils';

// --------------------------------------------------

function buildOptions(options?: FiltersParseOptions) : FiltersParseOptions {
    options ??= {};

    if (options.aliasMapping) {
        options.aliasMapping = buildObjectFromStringArray(options.aliasMapping);
    } else {
        options.aliasMapping = {};
    }

    options.relations ??= [];

    return options;
}

function transformFiltersParseOutputElement(element: FiltersParseOutputElement) : FiltersParseOutputElement {
    if (
        hasOwnProperty(element, 'alias') &&
        (
            typeof element.alias === 'undefined' ||
            element.alias === null
        )
    ) {
        delete element.alias;
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

function buildDefaultFiltersParseOutput(
    options: FiltersParseOptions,
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
        const keys = Object.keys(options.default);

        const output : FiltersParseOutput = [];

        for (let i = 0; i < keys.length; i++) {
            const fieldDetails = getFieldDetails(keys[i], options.defaultAlias);

            if (
                options.defaultByElement &&
                inputKeys.length > 0
            ) {
                const fieldWithAlias = buildFieldWithAlias(fieldDetails);
                if (hasOwnProperty(input, fieldWithAlias)) {
                    continue;
                }
            }

            if (options.defaultByElement || inputKeys.length === 0) {
                output.push(transformFiltersParseOutputElement({
                    ...(fieldDetails.alias ? { alias: fieldDetails.alias } : {}),
                    key: fieldDetails.name,
                    value: options.default[keys[i]],
                }));
            }
        }

        return input ? [...Object.values(input), ...output] : output;
    }

    return input ? Object.values(input) : [];
}

export function parseQueryFilters(
    data: unknown,
    options?: FiltersParseOptions,
) : FiltersParseOutput {
    options = options ?? {};

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

    options = buildOptions(options);

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

        keys[i] = getNameByAliasMapping(keys[i], options.aliasMapping);

        const fieldDetails : FieldDetails = getFieldDetails(keys[i], options.defaultAlias);
        if (!isAllowedByRelations(fieldDetails, options.relations, options.defaultAlias)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const keyWithAlias : string = buildFieldWithAlias(fieldDetails, options.defaultAlias);

        if (
            typeof options.allowed !== 'undefined' &&
            // eslint-disable-next-line no-loop-func,@typescript-eslint/no-loop-func
            !options.allowed.some((allowed) => minimatch(keys[i], allowed) || minimatch(keyWithAlias, allowed))
        ) {
            continue;
        }

        temp[keyWithAlias] = {
            ...(fieldDetails.alias ? { alias: fieldDetails.alias } : {}),
            key: fieldDetails.name,
            value: value as string | boolean | number,
        };
    }

    return transformFiltersParseOutput(
        buildDefaultFiltersParseOutput(options, temp),
    );
}
