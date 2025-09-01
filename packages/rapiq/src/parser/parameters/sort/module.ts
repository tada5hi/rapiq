/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import { DEFAULT_ID } from '../../../constants';
import { extractSubRelations } from '../../../schema/parameter/relations/helpers';
import type { ObjectLiteral } from '../../../types';
import {
    applyMapping,
    extendObject,
    isPathAllowed,
    isPropertyNameValid,
    parseKey,
} from '../../../utils';
import { FiltersParseError } from '../filters';
import { SortParseError } from './error';
import {
    Schema,
    SortDirection,
    SortSchema, defineSortSchema,
} from '../../../schema';
import { BaseParser } from '../../base';
import type { SortParseOptions, SortParseOutput } from './types';
import type { RelationsParseOutput } from '../relations';

export class SortParser extends BaseParser<
SortParseOptions,
SortParseOutput
> {
    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: SortParseOptions<RECORD> = {},
    ) {
        const schema = this.resolveSchema(options.schema);

        if (schema.default) {
            const output : SortParseOutput = {};

            const keys = Object.keys(schema.default);

            for (let i = 0; i < keys.length; i++) {
                const fieldDetails = parseKey(keys[i]);

                let path : string | undefined;
                if (fieldDetails.path) {
                    path = fieldDetails.path;
                } else if (schema.name) {
                    path = schema.name;
                }

                if (path) {
                    output[`${path}.${fieldDetails.name}`] = schema.default[keys[i]];
                } else {
                    output[fieldDetails.name] = schema.default[keys[i]];
                }
            }

            return output;
        }

        return {};
    }

    async parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: SortParseOptions<RECORD> = {}) : Promise<SortParseOutput> {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return this.buildDefaults(options);
        }

        const normalized = this.normalize(input, throwOnFailure);
        const grouped = this.groupObjectByBasePath(normalized);
        if (
            schema.name &&
            grouped[schema.name]
        ) {
            grouped[DEFAULT_ID] = grouped[schema.name];
            delete grouped[schema.name];
        }

        const output : SortParseOutput = {};

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;

        if (data) {
            const keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                const key = parseKey(keys[i]);
                key.name = applyMapping(key.name, schema.mapping);

                if (
                    schema.allowedIsUndefined &&
                    !isPropertyNameValid(key.name)
                ) {
                    if (throwOnFailure) {
                        throw SortParseError.keyInvalid(key.name);
                    }

                    continue;
                }

                if (
                    !schema.allowedIsUndefined &&
                    !this.isMultiDimensionalArray(schema.allowed) &&
                    schema.allowed &&
                    schema.allowed.indexOf(key.name) === -1
                ) {
                    if (throwOnFailure) {
                        throw SortParseError.keyNotPermitted(key.name);
                    }

                    continue;
                }

                output[key.name] = data[keys[i]];
            }

            if (this.isMultiDimensionalArray(schema.allowed)) {
                // eslint-disable-next-line no-labels,no-restricted-syntax
                outerLoop:
                for (let i = 0; i < schema.allowed.length; i++) {
                    const temp: SortParseOutput = {};

                    const keyPaths = schema.allowed[i];

                    for (let j = 0; j < keyPaths.length; j++) {
                        if (output[keyPaths[j]]) {
                            temp[keyPaths[j]] = output[keyPaths[j]];
                        } else {
                            // eslint-disable-next-line no-labels
                            continue outerLoop;
                        }
                    }

                    return temp;
                }

                // if we get no match, the sort data is invalid.
                return {};
            }
        }

        const outputKeys = Object.keys(output);
        if (outputKeys.length === 0) {
            extendObject(output, this.buildDefaults(options));
        }

        const keys = Object.keys(relationsData);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (!isPathAllowed(key, options.relations)) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(key);
                }

                continue;
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, key);
            if (!relationSchema) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(key);
                }

                continue;
            }

            let childRelations: RelationsParseOutput | undefined;
            if (typeof options.relations !== 'undefined') {
                childRelations = extractSubRelations(options.relations, key);
            }

            const relationOutput = await this.parse(
                relationsData[key],
                {
                    schema: relationSchema,
                    relations: childRelations,
                    throwOnFailure: options.throwOnFailure,
                },
            );

            const relationOutputKeys = Object.keys(relationOutput);
            for (let j = 0; j < relationOutputKeys.length; j++) {
                output[`${key}.${relationOutputKeys[j]}`] = relationOutput[relationOutputKeys[j]];
            }
        }

        return output;
    }

    /**
     * Return input normalized as
     * [KEY]: DIRECTION
     *
     * @param input
     * @param throwOnFailure
     */
    protected normalize(input: unknown, throwOnFailure?: boolean) : Record<string, SortDirection> {
        const output : Record<string, SortDirection> = {};

        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            let temp: unknown[] = [];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            for (let i = 0; i < temp.length; i++) {
                const key = temp[i];
                if (typeof key !== 'string') {
                    if (throwOnFailure) {
                        throw SortParseError.inputInvalid();
                    }

                    continue;
                }

                if (key.substring(0, 1) === '-') {
                    output[key.substring(1)] = SortDirection.DESC;
                } else {
                    output[key] = SortDirection.ASC;
                }
            }

            return output;
        }

        if (isObject(input)) {
            const keys = Object.keys(input);
            for (let i = 0; i < keys.length; i++) {
                const value = input[keys[i]];
                if (typeof value === 'string') {
                    const lowered = value.toLowerCase();
                    if (lowered === 'desc' || lowered === 'asc') {
                        output[keys[i]] = lowered === 'desc' ?
                            SortDirection.DESC :
                            SortDirection.ASC;

                        continue;
                    }
                }

                const temp = this.normalize(value, throwOnFailure);

                const tempKeys = Object.keys(temp);
                for (let j = 0; j < tempKeys.length; j++) {
                    let nextKey : string;
                    if (tempKeys[j] === DEFAULT_ID) {
                        nextKey = keys[i];
                    } else {
                        nextKey = `${keys[i]}.${tempKeys[j]}`;
                    }

                    output[nextKey] = temp[tempKeys[j]];
                }
            }

            return output;
        }

        if (input === undefined || input === null || input === '') {
            return {};
        }

        if (throwOnFailure) {
            throw SortParseError.inputInvalid();
        }

        return {};
    }

    // --------------------------------------------------

    protected isMultiDimensionalArray(arr: string[] | string[][]) : arr is string[][] {
        if (!Array.isArray(arr)) {
            return false;
        }

        return arr.length > 0 && Array.isArray(arr[0]);
    }

    // --------------------------------------------------

    protected resolveSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | SortSchema<RECORD>) : SortSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.sort;
        }

        if (input instanceof SortSchema) {
            return input;
        }

        return defineSortSchema();
    }
}
