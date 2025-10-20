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
import type { MaybeAsync, ObjectLiteral } from '../../../types';
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
import { LinkedList, LinkedListNode } from '../../../utils/linked-list';
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
    ) : MaybeAsync<Record<string, Filter[]>> {
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

        const list = new LinkedList<string>();

        list.addNode(new LinkedListNode(DEFAULT_ID));

        const keys = Object.keys(relationsData);
        for (let i = 0; i < keys.length; i++) {
            list.addNode(new LinkedListNode(keys[i]));
        }

        return this.processList(
            list.iterator(),
            inputGrouped,
            options,
        );
    }

    processList<RECORD extends ObjectLiteral>(
        iterator: Iterator<string, null>,
        data: Record<string, any>,
        options: FiltersParseOptions<RECORD> = {},
    ): MaybeAsync<Record<string, Filter[]>> {
        const schema = this.resolveSchema(options.schema);
        const throwOnFailure = options.throwOnFailure ?? schema.throwOnFailure;

        const currentKey = iterator.next();
        if (currentKey.done) {
            return {};
        }

        let relations : Relations | undefined;

        // todo: currentKey.value  === DEFAULT_ID && empty data =>build defaults otherwise

        if (currentKey.value !== DEFAULT_ID) {
            if (!isPathAllowed(currentKey.value, options.relations)) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(currentKey.value);
                }

                return {};
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, currentKey.value);
            if (!relationSchema) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(currentKey.value);
                }

                return {};
            }

            if (typeof options.relations !== 'undefined') {
                relations = options.relations.extract(currentKey.value);
            }
        }

        const currentKeyData = data[currentKey.value] || data;
        if (!currentKeyData) {
            return {};
        }

        const output : Record<string, Filter[]> = {};

        let maybeAsync : Promise<unknown> | undefined;

        const keys = Object.keys(currentKeyData);
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

            const valueParsed = this.parseValue(currentKeyData[keys[i]]);
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
                currentKey.value === DEFAULT_ID ?
                    key.name :
                    stringifyKey({ path: currentKey.value, name: key.name }),
                valueParsed.value,
            );

            const groupKey = key.group || '';
            if (!output[groupKey]) {
                output[groupKey] = [];
            }

            try {
                const validationResult = schema.validate(filter);

                if (maybeAsync || validationResult instanceof Promise) {
                    maybeAsync = (maybeAsync ?? Promise.resolve())
                        .then(async () => {
                            const result = await validationResult;
                            output[groupKey].push(result || filter);
                        })
                        .catch(() => {
                            if (throwOnFailure) {
                                throw FiltersParseError.keyValueInvalid(filter.field);
                            }
                        });
                } else {
                    output[groupKey].push(validationResult || filter);
                }
            } catch (e) {
                if (throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(filter.field);
                }
            }
        }

        const mergeGroups = (groups: Record<string, Filter[]>) => {
            const groupKeys = Object.keys(groups);
            for (let i = 0; i < groupKeys.length; i++) {
                const children = groups[groupKeys[i]];

                output[groupKeys[i]] ||= [];

                if (currentKey.value === DEFAULT_ID) {
                    output[groupKeys[i]].push(...children);
                } else {
                    output[groupKeys[i]].push(
                        ...children.map((child) => new Filter(
                            child.operator as `${FilterFieldOperator}`,
                            stringifyKey({ path: currentKey.value, name: child.field }),
                            child.value,
                        )),
                    );
                }
            }

            return output;
        };

        if (maybeAsync) {
            if (!options.async) {
                // todo: throw async error
                throw Error();
            }

            return maybeAsync
                .then(() => this.processList(
                    iterator,
                    currentKeyData,
                    {
                        ...options,
                        relations,
                    },
                ))
                .then((groups) => mergeGroups(groups));
        }

        const child = this.processList(
            iterator,
            currentKeyData,
            {
                ...options,
                relations,
            },
        );

        if (child instanceof Promise) {
            if (!options.async) {
                // todo: throw async error
                throw Error();
            }

            return child.then((groups) => mergeGroups(groups));
        }

        return mergeGroups(child);
    }

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Filters {
        const items = this.preParse(input, {
            ...options,
            async: false,
        });

        if (items instanceof Promise) {
            // todo: throw async error
            throw Error();
        }

        const itemKeys = Object.keys(items);
        if (itemKeys.length === 0) {
            return this.mergeGroups(this.groupDefaults(options));
        }

        return this.mergeGroups(items);
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<Filters> {
        const items = await this.preParse(input, {
            ...options,
            async: true,
        });

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
        const items : Record<string, Filter[]> = {};

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

            items[groupKey].push(new Filter(
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
