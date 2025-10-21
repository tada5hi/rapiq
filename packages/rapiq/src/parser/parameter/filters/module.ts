/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../../../constants';
import type { FilterValuePrimitive } from '../../../encoder';
import type { Condition, Relations } from '../../../parameter';
import {
    Filter,
    FilterRegexFlag, Filters, createFilterRegex, optimizedCompoundCondition,
} from '../../../parameter';
import {
    FilterCompoundOperator,
    FilterFieldOperator,
    FilterInputOperatorValue,
} from '../../../schema';
import type { ObjectLiteral } from '../../../types';
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
import type { TempType } from '../../base';
import { BaseFiltersParser } from './base';
import { FiltersParseError } from './error';
import { GraphNode, breadthFirstSearchReverse } from './graph';
import type { FiltersParseOptions } from './types';

export class SimpleFiltersParser extends BaseFiltersParser<
FiltersParseOptions
> {
    preParse<RECORD extends ObjectLiteral = ObjectLiteral>(
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

        return this.processList(
            DEFAULT_ID,
            normalized,
            options,
        );
    }

    processList<RECORD extends ObjectLiteral>(
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

            const children = this.processList(
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
    ) : Condition {
        let items = this.preParse(input, {
            ...options,
            async: false,
        });

        if (items.length === 0) {
            items = this.buildDefaults(options);
        }

        if (items.length === 1) {
            return items[0];
        }

        return new Filters(FilterCompoundOperator.AND, items);
    }

    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        options: FiltersParseOptions<RECORD> = {},
    ) : Condition[] {
        const schema = this.resolveSchema(options.schema);
        const output : Condition[] = [];

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

            output.push(new Filter(
                parsed.operator,
                buildKeyPath(keyDetails.name, path),
                parsed.value,
            ));
        }

        return output;
    }

    // ---------------------------------------------------------

    protected mergeGroups(
        input: Record<string, Condition[]> = {},
    ) : Filters {
        const graph = new GraphNode<Condition[]>('');

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            graph.add(keys[i], input[keys[i]]);
        }

        const stack : Map<number, Record<string, Condition[]>> = new Map();

        breadthFirstSearchReverse(graph, (node) => {
            const levelItems = stack.get(node.level) || {};
            const levelKey = node.id || '';
            if (!levelItems[levelKey]) {
                levelItems[levelKey] = [];
            }

            if (node.data) {
                levelItems[levelKey].push(
                    optimizedCompoundCondition(
                        FilterCompoundOperator.AND,
                        node.data,
                    ),
                );
            }

            // 1. get all children from child level (node.level + 1)
            const children = stack.get(node.level + 1);
            if (children) {
                // 2. children to conditions
                const conditions: Condition[] = [];
                const childrenKeys = Object.keys(children);
                for (let i = 0; i < childrenKeys.length; i++) {
                    if (
                        children[childrenKeys[i]] &&
                        children[childrenKeys[i]].length > 0
                    ) {
                        conditions.push(optimizedCompoundCondition(
                            FilterCompoundOperator.AND,
                            children[childrenKeys[i]],
                        ));
                    }
                }

                if (conditions.length > 0) {
                    // 3. set for current level + current id
                    levelItems[levelKey].push(optimizedCompoundCondition(
                        FilterCompoundOperator.OR,
                        conditions,
                    ));
                }
            }

            stack.set(node.level, levelItems);
        });

        const out = stack.get(0);
        if (out) {
            const conditions : Filters[] = [];

            const keys = Object.keys(out);
            for (let i = 0; i < keys.length; i++) {
                if (out[keys[i]].length > 0) {
                    conditions.push(optimizedCompoundCondition(
                        FilterCompoundOperator.AND,
                        out[keys[i]],
                    ));
                }
            }

            if (conditions.length === 1) {
                return conditions[0];
            }

            if (conditions.length === 0) {
                return new Filters(FilterCompoundOperator.AND, []);
            }

            return optimizedCompoundCondition(FilterCompoundOperator.OR, conditions);
        }

        return new Filters(FilterCompoundOperator.AND, []);
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
}
