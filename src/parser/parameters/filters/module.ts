/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { optimizedCompoundCondition } from '@ucast/core';
import { DEFAULT_ID } from '../../../constants';
import type { Condition } from '../../../schema';
import {
    CompoundCondition,
    FieldCondition,
    FilterCompoundOperator,
    FilterFieldOperator,
    FilterInputOperatorValue,
    FiltersSchema,
    Schema,
    defineFiltersSchema,
} from '../../../schema';
import type { FilterValuePrimitive } from '../../../builder';
import { extractSubRelations } from '../../../schema/parameter/relations/helpers';
import type { NestedKeys, ObjectLiteral } from '../../../types';
import {
    applyMapping,
    buildKeyPath,
    escapeRegExp,
    isObject,
    isPathAllowed,
    isPropertyNameValid,
    parseKey,
    stringifyKey,
} from '../../../utils';
import { FiltersParseError } from './error';
import { BaseParser } from '../../base';
import { GraphNode, breadthFirstSearchReverse } from './graph';
import type { FiltersParseOptions } from './types';

export class FiltersParser extends BaseParser<
FiltersParseOptions,
Condition
> {
    preParse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Record<string, FieldCondition[]> {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return this.groupDefaults(options);
        }

        /* istanbul ignore next */
        if (!isObject(input)) {
            if (throwOnFailure) {
                throw FiltersParseError.inputInvalid();
            }

            return this.groupDefaults(options);
        }

        const { length } = Object.keys(input);
        if (length === 0) {
            return this.groupDefaults(options);
        }

        const output : Record<string, FieldCondition[]> = {};

        const inputGrouped = this.groupObjectByBasePath(input);
        if (
            schema.name &&
            inputGrouped[schema.name]
        ) {
            inputGrouped[DEFAULT_ID] = inputGrouped[schema.name];
            delete inputGrouped[schema.name];
        }

        const {
            [DEFAULT_ID]: data,
            ...relationsData
        } = inputGrouped;

        // todo: build defaults otherwise
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

                const valueParsed = this.parseValue(data[keys[i]]);
                if (!valueParsed) {
                    if (throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(key.name);
                    }

                    continue;
                }

                if (Array.isArray(valueParsed.value)) {
                    const temp: (string | number)[] = [];
                    for (let j = 0; j < valueParsed.value.length; j++) {
                        if (schema.validate(key.name as NestedKeys<RECORD>, valueParsed.value[j])) {
                            temp.push(valueParsed.value[j]);
                        } else if (throwOnFailure) {
                            throw FiltersParseError.keyValueInvalid(key.name);
                        }
                    }

                    if (temp.length === 0) {
                        continue;
                    }

                    valueParsed.value = temp;
                } else {
                    if (
                        typeof valueParsed.value === 'string' &&
                        valueParsed.value.length === 0
                    ) {
                        if (throwOnFailure) {
                            throw FiltersParseError.keyValueInvalid(key.name);
                        }

                        continue;
                    }

                    if (!schema.validate(key.name as NestedKeys<RECORD>, valueParsed.value)) {
                        if (throwOnFailure) {
                            throw FiltersParseError.keyValueInvalid(key.name);
                        }

                        continue;
                    }
                }

                const outputKey = key.group || '';
                if (!output[outputKey]) {
                    output[outputKey] = [];
                }

                output[outputKey].push(new FieldCondition(
                    valueParsed.operator,
                    key.name,
                    valueParsed.value,
                ));
            }
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

            let childRelations: string[] | undefined;
            if (typeof options.relations !== 'undefined') {
                childRelations = extractSubRelations(options.relations, key);
            }

            const relationOutput = this.preParse(
                relationsData[key],
                {
                    schema: relationSchema,
                    relations: childRelations,
                    throwOnFailure: options.throwOnFailure,
                },
            );

            const relationOutputKeys = Object.keys(relationOutput);
            for (let j = 0; j < relationOutputKeys.length; j++) {
                if (!output[relationOutputKeys[j]]) {
                    output[relationOutputKeys[j]] = [];
                }

                output[relationOutputKeys[j]].push(...relationOutput[relationOutputKeys[j]].map(
                    (condition) => new FieldCondition(
                        condition.operator as `${FilterFieldOperator}`,
                        stringifyKey({ path: keys[i], name: condition.field }),
                        condition.value,
                    ),
                ));
            }
        }

        return output;
    }

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Condition {
        const items = this.preParse(input, options);

        console.log(input, items);

        const itemKeys = Object.keys(items);
        if (itemKeys.length === 0) {
            return this.mergeGroups(this.groupDefaults(options));
        }

        return this.mergeGroups(items);
    }

    protected groupDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: FiltersParseOptions<RECORD> = {},
    ) {
        const schema = this.resolveSchema(options.schema);
        const items : Record<string, FieldCondition[]> = {};

        for (let i = 0; i < schema.defaultKeys.length; i++) {
            const keyDetails = parseKey(schema.defaultKeys[i]);

            let path : string | undefined;
            if (keyDetails.path) {
                path = keyDetails.path;
            } else if (schema.name) {
                path = schema.name;
            }

            const parsed = this.parseValue(
                schema.default[schema.defaultKeys[i]],
            );
            if (!parsed) {
                continue;
            }

            const groupKey = keyDetails.group || '';
            if (!items[groupKey]) {
                items[groupKey] = [];
            }

            items[groupKey].push(new FieldCondition(
                parsed.operator,
                buildKeyPath(keyDetails.name, path),
                parsed.value,
            ));
        }

        return items;
    }

    // ---------------------------------------------------------

    protected mergeGroups(
        input: Record<string, Condition[]> = {},
    ) : Condition {
        const graph = new GraphNode<Condition[]>('');

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            graph.add(keys[i], input[keys[i]]);
        }

        const stack : Map<number, Record<string, Condition[]>> = new Map();

        breadthFirstSearchReverse(graph, (node) => {
            const levelItems = stack.get(node.level) || {};
            const levelKey = node.id || '';

            if (node.data) {
                levelItems[levelKey] = [
                    optimizedCompoundCondition(
                        FilterCompoundOperator.AND,
                        node.data,
                    ),
                ];
            } else {
                // 1. get all children from child level (node.level + 1)
                const children = stack.get(node.level + 1);
                if (!children) {
                    return;
                }

                // 2. children to conditions
                const conditions: Condition[] = [];
                const childrenKeys = Object.keys(children);
                for (let i = 0; i < childrenKeys.length; i++) {
                    conditions.push(optimizedCompoundCondition(
                        FilterCompoundOperator.AND,
                        children[childrenKeys[i]],
                    ));
                }

                // 3. set for current level + current id
                if (!levelItems[levelKey]) {
                    levelItems[levelKey] = [];
                }

                levelItems[levelKey].push(optimizedCompoundCondition(
                    FilterCompoundOperator.OR,
                    conditions,
                ));
            }

            stack.set(node.level, levelItems);
        });

        const out = stack.get(0);
        if (out) {
            const conditions : Condition[] = [];

            const keys = Object.keys(out);
            for (let i = 0; i < keys.length; i++) {
                conditions.push(optimizedCompoundCondition(
                    FilterCompoundOperator.AND,
                    out[keys[i]],
                ));
            }

            return optimizedCompoundCondition(FilterCompoundOperator.OR, conditions);
        }

        return new CompoundCondition(FilterCompoundOperator.OR, []);
    }

    protected parseValue(input: unknown) : {
        value: unknown,
        operator: `${FilterFieldOperator}`
    } | undefined {
        let value : FilterValuePrimitive | FilterValuePrimitive[];

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
        let negation : boolean = false;

        if (
            value.substring(0, 1) === FilterInputOperatorValue.NEGATION
        ) {
            negation = true;
            value = value.substring(1);
        }

        let startLike : boolean = false;
        let endLike : boolean = false;

        if (value.substring(0, FilterInputOperatorValue.LIKE.length) === FilterInputOperatorValue.LIKE) {
            value = value.substring(FilterInputOperatorValue.LIKE.length);
            startLike = true;
        }

        if (value.substring(value.length - 1) === FilterInputOperatorValue.LIKE) {
            value = value.substring(0, value.length - FilterInputOperatorValue.LIKE.length);
            endLike = true;
        }

        if (startLike || endLike) {
            value = escapeRegExp(value);

            let pattern : string;
            if (negation) {
                if (startLike && endLike) {
                    pattern = `^(?!.*${value}).*`;
                } else if (startLike) {
                    pattern = `^(?!${value}).+`;
                } else {
                    pattern = `^(?!.*${value}$).*`;
                }
            } else if (startLike && endLike) {
                pattern = `${value}`;
            } else if (startLike) {
                pattern = `^${value}`;
            } else {
                pattern = `${value}$`;
            }

            return {
                value: new RegExp(pattern, 'i'),
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

        if (negation) {
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

    protected normalizeValue(input: unknown) : FilterValuePrimitive | FilterValuePrimitive[] {
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
            const output : FilterValuePrimitive[] = [];

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

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FiltersSchema<RECORD>) : FiltersSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.filters;
        }

        if (input instanceof FiltersSchema) {
            return input;
        }

        return defineFiltersSchema();
    }
}
