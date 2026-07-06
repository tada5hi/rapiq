/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    DEFAULT_ID,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    Parameter,
    ResolutionScope,
    isObject,
    parseKey,
    stringifyKey,
} from '@rapiq/core';

import type {
    FiltersParseOptions,
    FiltersSchema,
    ICondition,
    IFilter,
    IFilters,
    ObjectLiteral,
    Scalar,

    TempType,
} from '@rapiq/core';

import { URLFilterOperator } from './constants';
import type { SimpleFiltersParserInput } from './types';

export class SimpleFiltersParser extends BaseParser<
    FiltersParseOptions,
    IFilters
> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        const scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
        });

        let items: ICondition[] = this.run(input, scope);

        if (items.length === 0) {
            items = this.buildDefaults(scope.schema);
        }

        return new Filters(FilterCompoundOperator.AND, items);
    }

    parseTyped<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        return this.parse(input, options);
    }

    protected run<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        scope: ResolutionScope<`${Parameter.FILTERS}`, RECORD>,
    ) : IFilter[] {
        const { schema } = scope;

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return [];
        }

        if (!isObject(input)) {
            // absent input is not a failure — schema defaults still apply.
            if (
                typeof input !== 'undefined' &&
                input !== null &&
                scope.throwOnFailure
            ) {
                throw FiltersParseError.inputInvalid();
            }

            return [];
        }

        const { length } = Object.keys(input);
        if (length === 0) {
            return [];
        }

        const normalized = this.groupObject(this.expandObject(input));

        const named = schema.name ? normalized.relations[schema.name] : undefined;
        if (schema.name && named) {
            normalized.attributes = {
                ...(normalized.attributes || {}),
                ...named.attributes,
            };
            normalized.relations = {
                ...(normalized.relations || {}),
                ...named.relations,
            };

            delete normalized.relations[schema.name];
        }

        return this.runFor(
            DEFAULT_ID,
            normalized,
            scope,
        );
    }

    protected runFor<RECORD extends ObjectLiteral = ObjectLiteral>(
        currentKey: string,
        data: TempType,
        scope: ResolutionScope<`${Parameter.FILTERS}`, RECORD>,
    ) : IFilter[] {
        // todo: currentKey.value  === DEFAULT_ID && empty data =>build defaults otherwise

        const output : IFilter[] = [];

        let keys = Object.keys(data.attributes);
        for (const key_ of keys) {
            const key = parseKey(key_);

            const resolved = scope.resolveKey(key.name);
            if (!resolved.success) {
                continue;
            }

            const resolvedName = [...resolved.path, resolved.name].join('.');

            const valueParsed = this.parseValue(data.attributes[key_]);
            if (!valueParsed) {
                if (scope.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(resolvedName);
                }

                continue;
            }

            if (!Array.isArray(valueParsed.value)) {
                if (
                    typeof valueParsed.value === 'string' &&
                    valueParsed.value.length === 0
                ) {
                    if (scope.throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(resolvedName);
                    }

                    continue;
                }
            }

            const filter = new Filter(
                valueParsed.operator,
                currentKey === DEFAULT_ID ?
                    resolvedName :
                    stringifyKey({ path: currentKey, name: resolvedName }),
                valueParsed.value,
            );

            output.push(filter);
        }

        keys = Object.keys(data.relations);
        for (const key of keys) {
            const child = scope.descend(key);
            if (!(child instanceof ResolutionScope)) {
                continue;
            }

            const relationData = data.relations[key];
            if (relationData === undefined) {
                continue;
            }

            const children = this.runFor(
                child.segment as string,
                relationData,
                child,
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

    protected buildDefaults<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(schema: FiltersSchema<RECORD>) : ICondition[] {
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
        } catch {
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
        let hasNegation = false;

        if (
            value.substring(0, 1) === URLFilterOperator.NEGATION
        ) {
            value = value.substring(1);
            hasNegation = true;
        }

        const hasLikeStart = value.substring(0, URLFilterOperator.LIKE.length) === URLFilterOperator.LIKE;
        const hasLikeEnd = value.substring(value.length - URLFilterOperator.LIKE.length) === URLFilterOperator.LIKE;

        if (hasLikeStart && hasLikeEnd) {
            if (hasNegation) {
                return {
                    value: value.substring(URLFilterOperator.LIKE.length, value.length - URLFilterOperator.LIKE.length),
                    operator: FilterFieldOperator.NOT_CONTAINS,
                };
            }

            return {
                value: value.substring(URLFilterOperator.LIKE.length, value.length - URLFilterOperator.LIKE.length),
                operator: FilterFieldOperator.CONTAINS,
            };
        }

        if (hasLikeStart) {
            if (hasNegation) {
                return {
                    value: value.substring(URLFilterOperator.LIKE.length),
                    operator: FilterFieldOperator.NOT_ENDS_WITH,
                };
            }

            return {
                value: value.substring(URLFilterOperator.LIKE.length),
                operator: FilterFieldOperator.ENDS_WITH,
            };
        }

        if (hasLikeEnd) {
            if (hasNegation) {
                return {
                    value: value.substring(0, value.length - URLFilterOperator.LIKE.length),
                    operator: FilterFieldOperator.NOT_STARTS_WITH,
                };
            }

            return {
                value: value.substring(0, value.length - URLFilterOperator.LIKE.length),
                operator: FilterFieldOperator.STARTS_WITH,
            };
        }

        if (
            value.substring(0, URLFilterOperator.LESS_THAN_EQUAL.length) === URLFilterOperator.LESS_THAN_EQUAL
        ) {
            return {
                value: this.normalizeValue(value.substring(URLFilterOperator.LESS_THAN_EQUAL.length)),
                operator: FilterFieldOperator.LESS_THAN_EQUAL,
            };
        }

        if (
            value.substring(0, URLFilterOperator.LESS_THAN.length) === URLFilterOperator.LESS_THAN
        ) {
            return {
                value: this.normalizeValue(value.substring(URLFilterOperator.LESS_THAN.length)),
                operator: FilterFieldOperator.LESS_THAN,
            };
        }

        if (
            value.substring(0, URLFilterOperator.GREATER_THAN_EQUAL.length) === URLFilterOperator.GREATER_THAN_EQUAL
        ) {
            return {
                value: this.normalizeValue(value.substring(URLFilterOperator.GREATER_THAN_EQUAL.length)),
                operator: FilterFieldOperator.GREATER_THAN_EQUAL,
            };
        }

        if (
            value.substring(0, URLFilterOperator.GREATER_THAN.length) === URLFilterOperator.GREATER_THAN
        ) {
            return {
                value: this.normalizeValue(value.substring(URLFilterOperator.GREATER_THAN.length)),
                operator: FilterFieldOperator.GREATER_THAN,
            };
        }

        if (hasNegation) {
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

            for (const element of input) {
                const temp = this.normalizeValue(element);
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
