/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
    Parameter,
    ResolutionScope,
    Sort,
    SortDirection,
    SortParseError,
    Sorts,
    isObject,
    parseKey,
} from '@rapiq/core';
import type {
    ISorts,
    ObjectLiteral,
    SortParseOptions,
    SortSchema,
} from '@rapiq/core';

export class SimpleSortParser extends BaseParser<SortParseOptions, ISorts> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: SortParseOptions<RECORD> = {}) : Sorts {
        const scope = ResolutionScope.for(this.registry, Parameter.SORT, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
        });

        return this.parseWithScope(input, scope);
    }

    protected parseWithScope<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, scope: ResolutionScope<`${Parameter.SORT}`, RECORD>) : Sorts {
        const { schema } = scope;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return this.buildDefaults(schema);
        }

        const normalized = this.normalize(input, scope.throwOnFailure);
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

                const resolved = scope.resolveKey(key.name);
                if (!resolved.success) {
                    continue;
                }

                output.value.push(new Sort(
                    [...resolved.path, resolved.name].join('.'),
                    data[key_],
                ));
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
            output.value.push(...this.buildDefaults(schema).value);
        }

        const keys = Object.keys(relationsData);
        for (const key of keys) {
            const child = scope.descend(key);
            if (!(child instanceof ResolutionScope)) {
                continue;
            }

            const relationOutput = this.parseWithScope(relationsData[key], child);

            for (const relation of relationOutput.value) {
                output.value.push(
                    new Sort(`${child.segment}.${relation.name}`, relation.operator),
                );
            }
        }

        return output;
    }

    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(schema: SortSchema<RECORD>) {
        const output = new Sorts();

        if (schema.default) {
            const keys = Object.keys(schema.default);

            // defaults come out in the same shape as input-derived keys:
            // local names stay local, explicit dotted keys keep their path.
            for (const key_ of keys) {
                const fieldDetails = parseKey(key_);

                let key : string;
                if (fieldDetails.path) {
                    key = `${fieldDetails.path}.${fieldDetails.name}`;
                } else {
                    key = fieldDetails.name;
                }

                output.value.push(new Sort(key, schema.default[key_]));
            }

            return output;
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
