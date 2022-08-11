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
import { determineFilterOperatorLabelsByValue } from './utils';

// --------------------------------------------------

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

    // Object.prototype.toString.call(data)
    /* istanbul ignore next */
    if (typeof data !== 'object') {
        return [];
    }

    const { length } = Object.keys(data);
    if (length === 0) {
        return [];
    }

    options = buildOptions(options);

    const temp : Record<string, {
        key: string,
        alias?: string,
        value: string | boolean | number | null
    }> = {};

    // transform to appreciate data format & validate input
    let keys = Object.keys(data);
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

            if ((value as string).toLowerCase() === 'null') {
                value = null;
            }
        }

        keys[i] = getNameByAliasMapping(keys[i], options.aliasMapping);

        const fieldDetails : FieldDetails = getFieldDetails(keys[i]);
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

        let alias : string | undefined;

        if (
            typeof fieldDetails.path === 'undefined' &&
            typeof fieldDetails.alias === 'undefined'
        ) {
            alias = options.defaultAlias ?
                options.defaultAlias :
                undefined;
        } else {
            alias = fieldDetails.alias;
        }

        temp[keyWithAlias] = {
            key: fieldDetails.name,
            ...(alias ? { alias } : {}),
            value: value as string | boolean | number,
        };
    }

    const items : FiltersParseOutput = [];

    /* istanbul ignore next */
    keys = Object.keys(temp);
    for (let i = 0; i < keys.length; i++) {
        /* istanbul ignore next */
        if (!Object.prototype.hasOwnProperty.call(temp, keys[i])) {
            continue;
        }

        const filter : FiltersParseOutputElement = {
            ...(temp[keys[i]].alias ? { alias: temp[keys[i]].alias } : {}),
            key: temp[keys[i]].key,
            value: temp[keys[i]].value,
        };

        if (typeof filter.value === 'string') {
            const { value, operators } = determineFilterOperatorLabelsByValue(filter.value);
            if (operators.length > 0) {
                filter.value = value;
                filter.operator = {};

                for (let i = 0; i < operators.length; i++) {
                    filter.operator[operators[i]] = true;
                }
            }
        }

        items.push(filter);
    }

    return items;
}
