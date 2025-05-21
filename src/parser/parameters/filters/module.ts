/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { FilterValueSimple } from '../../../builder';
import type { NestedKeys, ObjectLiteral } from '../../../types';
import type { KeyDetails } from '../../../utils';
import {
    applyMapping,
    buildKeyWithPath,
    hasOwnProperty,
    isObject,
    isPathAllowedByRelations,
    isPathCoveredByParseAllowedOption,
    isPropertyNameValid,
    parseKey,
} from '../../../utils';
import { FiltersParseError } from './error';
import { BaseParser } from '../../module';
import {
    FilterComparisonOperator, FilterInputOperatorValue, FiltersSchema, Schema, defineFiltersSchema,
} from '../../../schema';
import type { RelationsParseOutput } from '../relations';
import type { FiltersParseOutput, FiltersParseOutputElement } from './types';

type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>
};

export class FiltersParser extends BaseParser<
FiltersParseOptions,
FiltersParseOutput
> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        data: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : FiltersParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return this.toArray(undefined, options);
        }

        /* istanbul ignore next */
        if (!isObject(data)) {
            if (schema.throwOnFailure) {
                throw FiltersParseError.inputInvalid();
            }

            return this.toArray(undefined, options);
        }

        const { length } = Object.keys(data);
        if (length === 0) {
            return this.toArray(undefined, options);
        }

        const items : Record<string, FiltersParseOutputElement> = {};

        // transform to appreciate data format & validate input
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const value : unknown = data[keys[i]];

            if (
                typeof value !== 'string' &&
                typeof value !== 'number' &&
                typeof value !== 'boolean' &&
                typeof value !== 'undefined' &&
                value !== null &&
                !Array.isArray(value)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(keys[i]);
                }
                continue;
            }

            keys[i] = applyMapping(keys[i], schema.mapping);

            const fieldDetails : KeyDetails = parseKey(keys[i]);

            if (
                schema.allowedIsUndefined &&
                !isPropertyNameValid(fieldDetails.name)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }
                continue;
            }

            if (
                typeof fieldDetails.path !== 'undefined' &&
                !isPathAllowedByRelations(fieldDetails.path, options.relations)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(fieldDetails.path);
                }
                continue;
            }

            const fullKey : string = buildKeyWithPath(fieldDetails);
            if (
                !schema.allowedIsUndefined &&
                schema.allowed &&
                !isPathCoveredByParseAllowedOption(schema.allowed, [keys[i], fullKey])
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }

                continue;
            }

            const filter = this.normalizeOutputElement({
                key: fieldDetails.name,
                value: value as string | boolean | number,
            });

            if (Array.isArray(filter.value)) {
                const output : (string | number)[] = [];
                for (let j = 0; j < filter.value.length; j++) {
                    if (schema.validate(filter.key as NestedKeys<RECORD>, filter.value[j])) {
                        output.push(filter.value[j]);
                    } else if (schema.throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!schema.validate(filter.key as NestedKeys<RECORD>, filter.value)) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                typeof filter.value === 'string' &&
                filter.value.length === 0
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                Array.isArray(filter.value) &&
                filter.value.length === 0
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (fieldDetails.path || schema.defaultPath) {
                filter.path = fieldDetails.path || schema.defaultPath;
            }

            items[fullKey] = filter;
        }

        return this.toArray(items, options);
    }

    // ---------------------------------------------------------

    protected toArray<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: Record<string, FiltersParseOutputElement> = {},
        options: FiltersParseOptions<RECORD> = {},
    ) : FiltersParseOutput {
        const schema = this.resolveSchema(options.schema);

        const inputKeys = Object.keys(input || {});

        if (
            !schema.defaultByElement &&
            inputKeys.length > 0
        ) {
            return Object.values(input);
        }

        if (schema.defaultKeys.length > 0) {
            const output : FiltersParseOutput = [];

            for (let i = 0; i < schema.defaultKeys.length; i++) {
                const keyDetails = parseKey(schema.defaultKeys[i]);

                if (
                    schema.defaultByElement &&
                    inputKeys.length > 0
                ) {
                    const keyWithPath = buildKeyWithPath(keyDetails);
                    if (hasOwnProperty(input, keyWithPath)) {
                        continue;
                    }
                }

                if (schema.defaultByElement || inputKeys.length === 0) {
                    let path : string | undefined;
                    if (keyDetails.path) {
                        path = keyDetails.path;
                    } else if (schema.defaultPath) {
                        path = schema.defaultPath;
                    }

                    output.push(this.normalizeOutputElement({
                        ...(path ? { path } : {}),
                        key: keyDetails.name,
                        value: schema.default[schema.defaultKeys[i]],
                    }));
                }
            }

            return input ? [...Object.values(input), ...output] : output;
        }

        return input ? Object.values(input) : [];
    }

    // ^([0-9]+(?:\.[0-9]+)*){0,1}([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*){0,1}$
    normalizeOutputElement(element: FiltersParseOutputElement) : FiltersParseOutputElement {
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
                ...this.parseValue(element.value),
            };
        } else {
            element.operator = FilterComparisonOperator.EQUAL;
        }

        element.value = this.normalizeValue(element.value);

        return element;
    }

    protected parseValue(input: FilterValueSimple) : {
        operator: `${FilterComparisonOperator}`,
        value: FilterValueSimple
    } {
        if (
            typeof input === 'string' &&
            input.includes(FilterInputOperatorValue.IN)
        ) {
            input = input.split(FilterInputOperatorValue.IN);
        }

        let negation = false;

        let value = this.matchOperator(FilterInputOperatorValue.NEGATION, input, 'start');
        if (typeof value !== 'undefined') {
            negation = true;
            input = value;
        }

        if (Array.isArray(input)) {
            return {
                value: input,
                operator: negation ?
                    FilterComparisonOperator.NOT_IN :
                    FilterComparisonOperator.IN,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LIKE, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: negation ?
                    FilterComparisonOperator.NOT_LIKE :
                    FilterComparisonOperator.LIKE,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LESS_THAN_EQUAL, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.LESS_THAN_EQUAL,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LESS_THAN, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.LESS_THAN,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.MORE_THAN_EQUAL, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.GREATER_THAN_EQUAL,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.MORE_THAN, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.GREATER_THAN,
            };
        }

        return {
            value: input,
            operator: negation ?
                FilterComparisonOperator.NOT_EQUAL :
                FilterComparisonOperator.EQUAL,
        };
    }

    protected matchOperator(
        key: string,
        value: FilterValueSimple,
        position: 'start' | 'end' | 'global',
    ) : FilterValueSimple | undefined {
        if (typeof value === 'string') {
            switch (position) {
                case 'start': {
                    if (value.substring(0, key.length) === key) {
                        return value.substring(key.length);
                    }
                    break;
                }
                case 'end': {
                    if (value.substring(0 - key.length) === key) {
                        return value.substring(0, value.length - key.length - 1);
                    }
                    break;
                }
            }

            return undefined;
        }

        if (Array.isArray(value)) {
            let match = false;
            for (let i = 0; i < value.length; i++) {
                const output = this.matchOperator(key, value[i], position);
                if (typeof output !== 'undefined') {
                    match = true;
                    value[i] = output as string | number;
                }
            }

            if (match) {
                return value;
            }
        }

        return undefined;
    }

    protected normalizeValue(input: FilterValueSimple) : FilterValueSimple {
        if (typeof input === 'string') {
            input = input.trim();
            const lower = input.toLowerCase();

            if (lower === 'true') {
                return true;
            }

            if (lower === 'false') {
                return false;
            }

            if (lower === 'null') {
                return null;
            }

            if (input.length === 0) {
                return input;
            }

            const num = Number(input);
            if (!Number.isNaN(num)) {
                return num;
            }

            const parts = input.split(',');
            if (parts.length > 1) {
                return this.normalizeValue(parts);
            }
        }

        if (Array.isArray(input)) {
            for (let i = 0; i < input.length; i++) {
                input[i] = this.normalizeValue(input[i]) as string | number;
            }

            return (input as unknown[])
                .filter((n) => n === 0 || n === null || !!n) as FilterValueSimple;
        }

        if (typeof input === 'undefined' || input === null) {
            return null;
        }

        return input;
    }

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FiltersSchema<RECORD>) : FiltersSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.filters;
        }

        if (input instanceof FiltersSchema) {
            return input;
        }

        return defineFiltersSchema();
    }
}
