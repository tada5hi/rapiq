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
    Filters,
    FiltersParseError,
    Parameter,
    ResolutionScope,
    applyFiltersSchemaValidation,
    applyFiltersSchemaValidationAsync,
    buildFiltersDefaults,
    isObject,
    parseKey,
    stringifyKey,
} from '@rapiq/core';

import type {
    FilterFieldOperator,
    FiltersParseOptions,
    ICondition,
    IFilter,
    IFilters,
    ObjectLiteral,

    TempType,
} from '@rapiq/core';

import type { SimpleFiltersParserInput } from './types';
import { parseFilterWireValue } from './value';

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

        if (items.length > 0) {
            items = items
                .map((item) => applyFiltersSchemaValidation(item, scope.schema))
                .filter((item): item is ICondition => typeof item !== 'undefined');
        }

        if (items.length === 0) {
            items = buildFiltersDefaults(scope.schema);
        }

        return new Filters(FilterCompoundOperator.AND, items);
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        const scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
        });

        let items: ICondition[] = [];
        const parsed = this.run(input, scope);

        for (const item of parsed) {
            const validated = await applyFiltersSchemaValidationAsync(item, scope.schema);
            if (validated) {
                items.push(validated);
            }
        }

        if (items.length === 0) {
            items = buildFiltersDefaults(scope.schema);
        }

        return new Filters(FilterCompoundOperator.AND, items);
    }

    parseTyped<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        return this.parse(input, options);
    }

    parseTypedAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: SimpleFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        return this.parseAsync(input, options);
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

    protected parseValue(input: unknown) : {
        value: unknown,
        operator: `${FilterFieldOperator}`
    } | undefined {
        try {
            return parseFilterWireValue(input);
        } catch {
            return undefined;
        }
    }
}
