/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
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
import { SortParseError } from './errors';

import type {
    SortParseOutput,
    SortParseOutputElement,
} from './types';
import { parseSortValue } from './utils';
import type { RelationsParseOutput } from '../relations';
import type { Schema } from '../../schema';
import { BaseParser } from '../../parser';

type SortParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema
};

export class SortParser extends BaseParser<
SortParseOptions,
SortParseOutput
> {
    parse(input: unknown, options: SortParseOptions = {}) : SortParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            !schema.sort.allowedIsUndefined &&
            schema.sort.allowed.length === 0
        ) {
            return schema.sort.defaultOutput;
        }

        /* istanbul ignore next */
        if (
            typeof input !== 'string' &&
            !Array.isArray(input) &&
            !isObject(input)
        ) {
            if (schema.sort.options.throwOnFailure) {
                throw SortParseError.inputInvalid();
            }

            return schema.sort.defaultOutput;
        }

        let parts : string[] = [];

        if (typeof input === 'string') {
            parts = input.split(',');
        }

        if (Array.isArray(input)) {
            parts = input.filter((item) => typeof item === 'string');
        }

        if (isObject(input)) {
            const keys = Object.keys(input);
            for (let i = 0; i < keys.length; i++) {
                /* istanbul ignore next */
                if (
                    !hasOwnProperty(input, keys[i]) ||
                    typeof keys[i] !== 'string' ||
                    typeof input[keys[i]] !== 'string'
                ) {
                    if (schema.sort.options.throwOnFailure) {
                        throw SortParseError.keyValueInvalid(keys[i]);
                    }

                    continue;
                }

                const fieldPrefix = (input[keys[i]] as string)
                    .toLowerCase() === 'desc' ? '-' : '';

                parts.push(fieldPrefix + keys[i]);
            }
        }

        const items : Record<string, SortParseOutputElement> = {};

        let matched = false;

        for (let i = 0; i < parts.length; i++) {
            const { value, direction } = parseSortValue(parts[i]);
            parts[i] = value;

            const key: string = applyMapping(parts[i], schema.sort.options.mapping);

            const fieldDetails = parseKey(key);

            if (
                schema.sort.allowedIsUndefined &&
                !isValidFieldName(fieldDetails.name)
            ) {
                if (schema.sort.options.throwOnFailure) {
                    throw SortParseError.keyInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                !isPathAllowedByRelations(fieldDetails.path, options.relations) &&
                typeof fieldDetails.path !== 'undefined'
            ) {
                if (schema.sort.options.throwOnFailure) {
                    throw SortParseError.keyPathInvalid(fieldDetails.path);
                }

                continue;
            }

            const keyWithAlias = buildKeyWithPath(fieldDetails);
            if (
                !schema.sort.allowedIsUndefined &&
                schema.sort.allowed &&
                !this.isMultiDimensionalArray(schema.sort.options.allowed) &&
                !isPathCoveredByParseAllowedOption(schema.sort.allowed, [key, keyWithAlias])
            ) {
                if (schema.sort.options.throwOnFailure) {
                    throw SortParseError.keyNotAllowed(fieldDetails.name);
                }

                continue;
            }

            matched = true;

            let path : string | undefined;
            if (fieldDetails.path) {
                path = fieldDetails.path;
            } else if (schema.sort.options.defaultPath) {
                path = schema.sort.options.defaultPath;
            }

            items[keyWithAlias] = {
                key: fieldDetails.name,
                ...(path ? { path } : {}),
                value: direction,
            };
        }

        if (!matched) {
            return schema.sort.defaultOutput;
        }

        if (this.isMultiDimensionalArray(schema.sort.options.allowed)) {
            // eslint-disable-next-line no-labels,no-restricted-syntax
            outerLoop:
            for (let i = 0; i < schema.sort.allowed.length; i++) {
                const temp : SortParseOutput = [];

                const keyPaths = flattenParseAllowedOption(schema.sort.options.allowed[i] as string[]);

                for (let j = 0; j < keyPaths.length; j++) {
                    let keyWithAlias : string = keyPaths[j];
                    let key : string;

                    const parts = keyWithAlias.split('.');
                    if (parts.length > 1) {
                        key = parts.pop() as string;
                    } else {
                        key = keyWithAlias;

                        keyWithAlias = buildKeyPath(key, schema.sort.options.defaultPath);
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

    // --------------------------------------------------

    protected isMultiDimensionalArray(arr: unknown) : arr is unknown[][] {
        if (!Array.isArray(arr)) {
            return false;
        }

        return arr.length > 0 && Array.isArray(arr[0]);
    }
}
