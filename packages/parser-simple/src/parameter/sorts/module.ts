/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseSortParser,
    DEFAULT_ID,
    FiltersParseError,
    Sort,
    SortDirection,
    SortParseError,
    Sorts,
    applyMapping,

    isObject,
    isPathAllowed,
    isPropertyNameValid,
    parseKey,
} from '@rapiq/core';
import type { ObjectLiteral, Relations, SortParseOptions } from '@rapiq/core';

export class SimpleSortParser extends BaseSortParser<SortParseOptions> {
    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: SortParseOptions<RECORD> = {},
    ) {
        const output = new Sorts();

        const schema = this.resolveSchema(options.schema);
        if (schema.default) {
            const keys = Object.keys(schema.default);

            for (const key_ of keys) {
                const fieldDetails = parseKey(key_);

                let path : string | undefined;
                if (fieldDetails.path) {
                    path = fieldDetails.path;
                } else if (schema.name) {
                    path = schema.name;
                }

                let key : string;
                if (path) {
                    key = `${path}.${fieldDetails.name}`;
                } else {
                    key = fieldDetails.name;
                }

                output.value.push(new Sort(key, schema.default[key_]));
            }

            return output;
        }

        return output;
    }

    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: SortParseOptions<RECORD> = {}) : Sorts {
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
        if (schema.name) {
            const named = grouped[schema.name];
            if (named) {
                grouped[DEFAULT_ID] = named;
                delete grouped[schema.name];
            }
        }

        const output = new Sorts();

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = grouped;

        if (data) {
            const keys = Object.keys(data);
            for (const key_ of keys) {
                const key = parseKey(key_);
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
                    !schema.allowed.includes(key.name)
                ) {
                    if (throwOnFailure) {
                        throw SortParseError.keyNotPermitted(key.name);
                    }

                    continue;
                }

                output.value.push(new Sort(key.name, data[key_]));
            }

            if (this.isMultiDimensionalArray(schema.allowed)) {
                // eslint-disable-next-line no-labels
                outerLoop:
                for (const keyPaths of schema.allowed) {
                    const temp = new Sorts();

                    for (const keyPath of keyPaths) {
                        const index = output.value.findIndex((el) => el.name === keyPath);
                        if (index !== -1) {
                            const found = output.value[index];
                            if (found !== undefined) {
                                temp.value.push(found);
                            }
                        } else {
                            // eslint-disable-next-line no-labels
                            continue outerLoop;
                        }
                    }

                    return temp;
                }

                // if we get no match, the sort data is invalid.
                return new Sorts();
            }
        }

        if (output.value.length === 0) {
            output.value.push(...this.buildDefaults(options).value);
        }

        const keys = Object.keys(relationsData);
        for (const key of keys) {
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

            let childRelations: Relations | undefined;
            if (typeof options.relations !== 'undefined') {
                childRelations = options.relations.extract(key);
            }

            const relationOutput = this.parse(
                relationsData[key],
                {
                    schema: relationSchema,
                    relations: childRelations,
                    throwOnFailure: options.throwOnFailure,
                },
            );

            for (const relation of relationOutput.value) {
                output.value.push(
                    new Sort(`${key}.${relation.name}`, relation.operator),
                );
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
            let temp: unknown[];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            for (const key of temp) {
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
            for (const key of keys) {
                const value = input[key];
                if (typeof value === 'string') {
                    const lowered = value.toLowerCase();
                    if (lowered === 'desc' || lowered === 'asc') {
                        output[key] = lowered === 'desc' ?
                            SortDirection.DESC :
                            SortDirection.ASC;

                        continue;
                    }
                }

                const temp = this.normalize(value, throwOnFailure);

                for (const [tempKey, value] of Object.entries(temp)) {
                    let nextKey : string;
                    if (tempKey === DEFAULT_ID) {
                        nextKey = key;
                    } else {
                        nextKey = `${key}.${tempKey}`;
                    }

                    output[nextKey] = value;
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
}
