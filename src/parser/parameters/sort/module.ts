/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import type { ObjectLiteral } from '../../../types';
import {
    applyMapping,
    buildKeyPath,
    buildKeyWithPath,
    flattenParseAllowedOption,
    hasOwnProperty,
    isPathAllowedByRelations,
    isPathCoveredByParseAllowedOption,
    isPropertyNameValid,
    parseKey,
} from '../../../utils';
import { SortParseError } from './error';
import {
    Schema,
    SortDirection,
    SortSchema,
    defineSortSchema,
} from '../../../schema';
import { BaseParser } from '../../module';
import type { RelationsParseOutput } from '../relations';
import type { SortParseOutput, SortParseOutputElement } from './types';

type SortParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    schema?: string | Schema<RECORD> | SortSchema<RECORD>
};

export class SortParser extends BaseParser<
SortParseOptions,
SortParseOutput
> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: SortParseOptions<RECORD> = {}) : SortParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return schema.defaultOutput;
        }

        /* istanbul ignore next */
        if (
            typeof input !== 'string' &&
            !Array.isArray(input) &&
            !isObject(input)
        ) {
            if (schema.throwOnFailure) {
                throw SortParseError.inputInvalid();
            }

            return schema.defaultOutput;
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
                    if (schema.throwOnFailure) {
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
            const { value, direction } = this.parseValue(parts[i]);
            parts[i] = value;

            const key: string = applyMapping(parts[i], schema.mapping);

            const fieldDetails = parseKey(key);

            if (
                schema.allowedIsUndefined &&
                !isPropertyNameValid(fieldDetails.name)
            ) {
                if (schema.throwOnFailure) {
                    throw SortParseError.keyInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                !isPathAllowedByRelations(fieldDetails.path, options.relations) &&
                typeof fieldDetails.path !== 'undefined'
            ) {
                if (schema.throwOnFailure) {
                    throw SortParseError.keyPathInvalid(fieldDetails.path);
                }

                continue;
            }

            const keyWithAlias = buildKeyWithPath(fieldDetails);
            if (
                !schema.allowedIsUndefined &&
                schema.allowed &&
                !this.isMultiDimensionalArray(schema.allowedRaw) &&
                !isPathCoveredByParseAllowedOption(schema.allowed, [key, keyWithAlias])
            ) {
                if (schema.throwOnFailure) {
                    throw SortParseError.keyNotAllowed(fieldDetails.name);
                }

                continue;
            }

            matched = true;

            let path : string | undefined;
            if (fieldDetails.path) {
                path = fieldDetails.path;
            } else if (schema.defaultPath) {
                path = schema.defaultPath;
            }

            items[keyWithAlias] = {
                key: fieldDetails.name,
                ...(path ? { path } : {}),
                value: direction,
            };
        }

        if (!matched) {
            return schema.defaultOutput;
        }

        if (this.isMultiDimensionalArray(schema.allowedRaw)) {
            // eslint-disable-next-line no-labels,no-restricted-syntax
            outerLoop:
            for (let i = 0; i < schema.allowed.length; i++) {
                const temp : SortParseOutput = [];

                const keyPaths = flattenParseAllowedOption(schema.allowedRaw[i] as string[]);

                for (let j = 0; j < keyPaths.length; j++) {
                    let keyWithAlias : string = keyPaths[j];
                    let key : string;

                    const parts = keyWithAlias.split('.');
                    if (parts.length > 1) {
                        key = parts.pop() as string;
                    } else {
                        key = keyWithAlias;

                        keyWithAlias = buildKeyPath(key, schema.defaultPath);
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

    protected parseValue(value: string) : {value: string, direction: `${SortDirection}`} {
        let direction: SortDirection = SortDirection.ASC;
        if (value.substring(0, 1) === '-') {
            direction = SortDirection.DESC;
            value = value.substring(1);
        }

        return {
            direction,
            value,
        };
    }

    // --------------------------------------------------

    protected resolveSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | SortSchema<RECORD>) : SortSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.sort;
        }

        if (input instanceof SortSchema) {
            return input;
        }

        return defineSortSchema();
    }
}
