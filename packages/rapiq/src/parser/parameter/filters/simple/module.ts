/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../../../../constants';
import type { Condition, Relations } from '../../../../parameter';
import {
    Filter,
    FilterRegexFlag, Filters, createFilterRegex,
} from '../../../../parameter';
import {
    FilterCompoundOperator,
    FilterFieldOperator,
    FilterInputOperatorValue,
} from '../../../../schema';
import type { ObjectLiteral, Scalar } from '../../../../types';
import {
    applyMapping,
    escapeRegExp,
    isObject,
    isPathAllowed,
    isPropertyNameValid,
    parseKey,
    stringifyKey,
} from '../../../../utils';
import type { TempType } from '../../../base';
import { BaseFiltersParser } from '../base';
import { FiltersParseError } from '../error';
import type { FiltersParseOptions } from '../types';
import type { SimpleFiltersParserInput } from './types';

export class SimpleFiltersParser extends BaseFiltersParser<
FiltersParseOptions
> {
    protected run<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Condition[] {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return [];
        }

        /* istanbul ignore next */
        if (!isObject(input)) {
            if (throwOnFailure) {
                throw FiltersParseError.inputInvalid();
            }

            return [];
        }

        const { length } = Object.keys(input);
        if (length === 0) {
            return [];
        }

        const normalized = this.groupObject(this.expandObject(input));

        if (
            schema.name &&
            normalized.relations[schema.name]
        ) {
            normalized.attributes = {
                ...(normalized.attributes || {}),
                ...normalized.relations[schema.name].attributes,
            };
            normalized.relations = {
                ...(normalized.relations || {}),
                ...normalized.relations[schema.name].relations,
            };

            delete normalized.relations[schema.name];
        }

        return this.runFor(
            DEFAULT_ID,
            normalized,
            options,
        );
    }

    protected runFor<RECORD extends ObjectLiteral>(
        currentKey: string,
        data: TempType,
        options: FiltersParseOptions<RECORD> = {},
    ) : Filter[] {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        let relations : Relations | undefined;

        // todo: currentKey.value  === DEFAULT_ID && empty data =>build defaults otherwise

        const output : Filter[] = [];

        let keys = Object.keys(data.attributes);
        for (let i = 0; i < keys.length; i++) {
            const key = parseKey(keys[i]);
            key.name = applyMapping(key.name, schema.mapping);

            if (
                schema.allowedIsUndefined &&
                !isPropertyNameValid(key.name)
            ) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyInvalid(key.name);
                }

                continue;
            }

            if (
                !schema.allowedIsUndefined &&
                schema.allowed.indexOf(key.name) === -1
            ) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyInvalid(key.name);
                }

                continue;
            }

            const valueParsed = this.parseValue(data.attributes[keys[i]]);
            if (!valueParsed) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(key.name);
                }

                continue;
            }

            if (!Array.isArray(valueParsed.value)) {
                if (
                    typeof valueParsed.value === 'string' &&
                    valueParsed.value.length === 0
                ) {
                    if (throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(key.name);
                    }

                    continue;
                }
            }

            const filter = new Filter(
                valueParsed.operator,
                currentKey === DEFAULT_ID ?
                    key.name :
                    stringifyKey({ path: currentKey, name: key.name }),
                valueParsed.value,
            );

            output.push(filter);
        }

        keys = Object.keys(data.relations);
        for (let i = 0; i < keys.length; i++) {
            if (!isPathAllowed(keys[i], options.relations)) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(keys[i]);
                }

                continue;
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, keys[i]);
            if (!relationSchema) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(keys[i]);
                }

                continue;
            }

            if (typeof options.relations !== 'undefined') {
                relations = options.relations.extract(keys[i]);
            }

            const children = this.runFor(
                keys[i],
                data.relations[keys[i]],
                {
                    ...options,
                    relations,
                    schema: relationSchema,
                },
            );

            if (currentKey === DEFAULT_ID) {
                output.push(...children);
            } else {
                output.push(...children.map((child) => new Filter(
                    child.operator as `${FilterFieldOperator}`,
                    stringifyKey({ path: currentKey, name: child.field }),
                    child.value,
                )));
            }
        }

        return output;
    }

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Filters {
        let items = this.run(input, {
            ...options,
            async: false,
        });

        if (items.length === 0) {
            items = this.buildDefaults(options);
        }

        return new Filters(FilterCompoundOperator.AND, items);
    }

    parseTyped<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : Filters {
        return this.parse(input, options);
    }

    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: FiltersParseOptions<RECORD> = {},
    ) : Condition[] {
        const schema = this.resolveSchema(options.schema);
        if (!schema.default) {
            return [];
        }

        if (Array.isArray(schema.default)) {
            return schema.default;
        }

        return [schema.default];
    }

    // ---------------------------------------------------------

    protected parseValue(input: unknown) : {
        value: unknown,
        operator: `${FilterFieldOperator}`
    } | undefined {
        let value : Scalar | Scalar[];

        try {
            value = this.normalizeValue(input);
        } catch (e) {
            return undefined;
        }

        if (typeof value !== 'string' && !Array.isArray(value)) {
            return { value, operator: FilterFieldOperator.EQUAL };
        }

        if (Array.isArray(value)) {
            const [first, ...rest] = value;
            if (typeof first === 'string') {
                const parsed = this.parseStringValue(first);
                if (parsed.operator === FilterFieldOperator.NOT_EQUAL) {
                    return {
                        value: [parsed.value, ...rest],
                        operator: FilterFieldOperator.NOT_IN,
                    };
                }
            }

            return { value, operator: FilterFieldOperator.IN };
        }

        return this.parseStringValue(value);
    }

    protected parseStringValue(value: string) : {
        operator: `${FilterFieldOperator}`,
        value: unknown
    } {
        let flag : number = 0;

        if (
            value.substring(0, 1) === FilterInputOperatorValue.NEGATION
        ) {
            value = value.substring(1);
            flag |= FilterRegexFlag.NEGATION;
        }

        if (value.substring(0, FilterInputOperatorValue.LIKE.length) === FilterInputOperatorValue.LIKE) {
            value = value.substring(FilterInputOperatorValue.LIKE.length);
            flag |= FilterRegexFlag.STARTS_WITH;
        }

        if (value.substring(value.length - 1) === FilterInputOperatorValue.LIKE) {
            value = value.substring(0, value.length - FilterInputOperatorValue.LIKE.length);
            flag |= FilterRegexFlag.ENDS_WITH;
        }

        if (
            (flag & FilterRegexFlag.STARTS_WITH) ||
            (flag & FilterRegexFlag.ENDS_WITH)
        ) {
            return {
                value: createFilterRegex(
                    escapeRegExp(value),
                    flag,
                ),
                operator: FilterFieldOperator.REGEX,
            };
        }

        if (
            value.substring(0, FilterInputOperatorValue.LESS_THAN_EQUAL.length) === FilterInputOperatorValue.LESS_THAN_EQUAL
        ) {
            return {
                value: this.normalizeValue(value.substring(FilterInputOperatorValue.LESS_THAN_EQUAL.length)),
                operator: FilterFieldOperator.LESS_THAN_EQUAL,
            };
        }

        if (
            value.substring(0, FilterInputOperatorValue.LESS_THAN.length) === FilterInputOperatorValue.LESS_THAN
        ) {
            return {
                value: this.normalizeValue(value.substring(FilterInputOperatorValue.LESS_THAN.length)),
                operator: FilterFieldOperator.LESS_THAN,
            };
        }

        if (
            value.substring(0, FilterInputOperatorValue.GREATER_THAN_EQUAL.length) === FilterInputOperatorValue.GREATER_THAN_EQUAL
        ) {
            return {
                value: this.normalizeValue(value.substring(FilterInputOperatorValue.GREATER_THAN_EQUAL.length)),
                operator: FilterFieldOperator.GREATER_THAN_EQUAL,
            };
        }

        if (
            value.substring(0, FilterInputOperatorValue.GREATER_THAN.length) === FilterInputOperatorValue.GREATER_THAN
        ) {
            return {
                value: this.normalizeValue(value.substring(FilterInputOperatorValue.GREATER_THAN.length)),
                operator: FilterFieldOperator.GREATER_THAN,
            };
        }

        if (flag & FilterRegexFlag.NEGATION) {
            return {
                value: this.normalizeValue(value),
                operator: FilterFieldOperator.NOT_EQUAL,
            };
        }

        return {
            value: this.normalizeValue(value),
            operator: FilterFieldOperator.EQUAL,
        };
    }

    protected normalizeValue(input: unknown) : Scalar | Scalar[] {
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed.length === 0) {
                return trimmed;
            }

            const lower = trimmed.toLowerCase();

            if (lower === 'true') {
                return true;
            }

            if (lower === 'false') {
                return false;
            }

            if (lower === 'null') {
                return null;
            }

            const num = Number(trimmed);
            if (!Number.isNaN(num)) {
                return num;
            }

            const parts = trimmed.split(',');
            if (parts.length > 1) {
                return this.normalizeValue(parts);
            }

            return trimmed;
        }

        if (typeof input === 'number') {
            return input;
        }

        if (Array.isArray(input)) {
            const output : Scalar[] = [];

            for (let i = 0; i < input.length; i++) {
                const temp = this.normalizeValue(input[i]);
                if (Array.isArray(temp)) {
                    output.push(...temp);
                } else {
                    output.push(temp);
                }
            }

            return output
                .filter((n) => n === 0 || n === null || !!n);
        }

        if (typeof input === 'undefined' || input === null) {
            return null;
        }

        throw new SyntaxError('Value can not be normalized.');
    }
}
