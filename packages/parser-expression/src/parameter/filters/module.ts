/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FiltersParseOptions,
    IFilter,
    IFilters,
    ObjectLiteral,
    Scalar,
} from '@rapiq/core';
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
    isFilters,
} from '@rapiq/core';
import { FilterTokenType } from './constants';
import type { FilterToken } from './types';

type FiltersScope = ResolutionScope<`${Parameter.FILTERS}`>;

/**
 * @see https://www.jsonapi.net/usage/reading/filtering.html
 */
export class ExpressionFiltersParser extends BaseParser<
    FiltersParseOptions,
    IFilters
> {
    private tokens: FilterToken[] = [];

    private pos = 0;

    // ---------------------------------------------------------

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        const expr = this.parseExact(input, options);
        if (
            isFilters(expr, FilterCompoundOperator.AND) ||
            isFilters(expr, FilterCompoundOperator.OR)
        ) {
            return expr;
        }

        return new Filters(FilterCompoundOperator.AND, [expr]);
    }

    parseExact<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters | IFilter {
        if (typeof input !== 'string') {
            throw FiltersParseError.inputInvalid();
        }

        this.pos = 0;
        this.tokens = this.tokenize(input);

        // expressions are precise — invalid keys always throw,
        // but only when a schema constrains the parse.
        let scope : FiltersScope | undefined;
        if (options.schema) {
            scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
                relations: options.relations,
                throwOnFailure: true,
            }) as FiltersScope;
        }

        const expr = this.parseFilterExpression(scope);
        if (this.peek().type !== FilterTokenType.EOF) {
            throw new Error(`Unexpected token: ${this.peek().type}`);
        }

        return expr;
    }

    // ---------------------------------------------------------

    private peek(): FilterToken {
        return this.tokens[this.pos] || { type: FilterTokenType.EOF };
    }

    private consume(expected?: `${FilterTokenType}`): FilterToken {
        const token = this.peek();
        if (expected && token.type !== expected) {
            throw new Error(`Expected ${expected}, got ${token.type}`);
        }
        this.pos++;
        return token;
    }

    private tokenize(input: string): FilterToken[] {
        const tokens: FilterToken[] = [];
        const regex = /\s+|and|or|eq|ne|gte|gt|lte|lt|contains|startsWith|endsWith|nin|in|null|\(|\)|,|'(?:''|[^'])*'|[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?/g;

        let match: RegExpExecArray | null;
         
        while ((match = regex.exec(input))) {
            const value = match[0];
            if (/^\s+$/.test(value)) continue;

            switch (value) {
                case 'not': tokens.push({ type: FilterTokenType.NOT }); break;
                case 'and': tokens.push({ type: FilterTokenType.AND }); break;
                case 'or': tokens.push({ type: FilterTokenType.OR }); break;
                case 'eq': tokens.push({ type: FilterTokenType.EQUAL }); break;
                case 'gt': tokens.push({ type: FilterTokenType.GREATER_THAN }); break;
                case 'gte': tokens.push({ type: FilterTokenType.GREATER_OR_EQUAL }); break;
                case 'lt': tokens.push({ type: FilterTokenType.LESS_THAN }); break;
                case 'lte': tokens.push({ type: FilterTokenType.LESS_OR_EQUAL }); break;
                case 'contains': tokens.push({ type: FilterTokenType.CONTAINS }); break;
                case 'startsWith': tokens.push({ type: FilterTokenType.STARTS_WITH }); break;
                case 'endsWith': tokens.push({ type: FilterTokenType.ENDS_WITH }); break;
                case 'in': tokens.push({ type: FilterTokenType.IN }); break;
                case 'nin': tokens.push({ type: FilterTokenType.NIN }); break;
                case 'null': tokens.push({ type: FilterTokenType.NULL }); break;
                case '(': tokens.push({ type: FilterTokenType.LPAREN }); break;
                case ')': tokens.push({ type: FilterTokenType.RPAREN }); break;
                case ',': tokens.push({ type: FilterTokenType.COMMA }); break;
                default:
                    if (
                        value.startsWith('\'') &&
                        value.endsWith('\'')
                    ) {
                        tokens.push({ type: FilterTokenType.ESCAPED_TEXT, value });
                    } else {
                        tokens.push({ type: FilterTokenType.FIELD, value });
                    }
            }
        }

        tokens.push({ type: 'EOF' });
        return tokens;
    }

    private parseFilterExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ) : Filters | Filter {
        const token = this.peek();
        switch (token.type) {
            case FilterTokenType.NOT:
                return this.parseNotExpression(scope, negation);
            case FilterTokenType.AND:
            case FilterTokenType.OR:
                return this.parseLogicalExpression(scope, negation);
            case FilterTokenType.EQUAL:
            case FilterTokenType.GREATER_THAN:
            case FilterTokenType.GREATER_OR_EQUAL:
            case FilterTokenType.LESS_THAN:
            case FilterTokenType.LESS_OR_EQUAL:
                return this.parseComparisonExpression(scope, negation);
            case FilterTokenType.CONTAINS:
            case FilterTokenType.STARTS_WITH:
            case FilterTokenType.ENDS_WITH:
                return this.parseMatchExpression(scope, negation);
            case FilterTokenType.IN:
            case FilterTokenType.NIN:
                return this.parseInExpression(scope, negation);
            default:
                throw new Error(`Unexpected token in filterExpression: ${token.type}`);
        }
    }

    private parseNotExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ): Filters | Filter {
        this.consume(FilterTokenType.NOT);
        this.consume(FilterTokenType.LPAREN);
        const expr = this.parseFilterExpression(scope, !negation);
        this.consume(FilterTokenType.RPAREN);

        return expr;
    }

    private parseLogicalExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ): Filters | Filter {
        let op = this.consume().type; // AND / OR
        if (op !== FilterTokenType.AND && op !== FilterTokenType.OR) {
            throw new Error('Expected AND or OR token type.');
        }

        this.consume(FilterTokenType.LPAREN);
        const expressions: (Filter | Filters)[] = [this.parseFilterExpression(scope, negation)];
        while (this.peek().type === FilterTokenType.COMMA) {
            this.consume(FilterTokenType.COMMA);
            expressions.push(this.parseFilterExpression(scope, negation));
        }
        this.consume(FilterTokenType.RPAREN);

        if (negation) {
            if (op === FilterTokenType.AND) {
                op = FilterTokenType.OR;
            } else {
                op = FilterTokenType.AND;
            }
        }

        if (op === FilterTokenType.AND) {
            return new Filters(
                FilterCompoundOperator.AND,
                expressions,
            );
        }

        return new Filters(FilterCompoundOperator.OR, expressions);
    }

    private parseComparisonExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ): Filters | Filter {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const left = this.parseExpressionFieldChain(scope);
        this.consume(FilterTokenType.COMMA);
        const right = this.parseExpressionValue();
        this.consume(FilterTokenType.RPAREN);

        switch (op) {
            case FilterTokenType.EQUAL: {
                if (negation) {
                    return new Filter(
                        FilterFieldOperator.NOT_EQUAL,
                        left as string,
                        right as string,
                    );
                }

                return new Filter(
                    FilterFieldOperator.EQUAL,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.GREATER_THAN: {
                if (negation) {
                    return new Filter(
                        FilterFieldOperator.LESS_THAN_EQUAL,
                        left as string,
                        right as string,
                    );
                }
                return new Filter(
                    FilterFieldOperator.GREATER_THAN,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.GREATER_OR_EQUAL: {
                if (negation) {
                    return new Filter(
                        FilterFieldOperator.LESS_THAN,
                        left as string,
                        right as string,
                    );
                }
                return new Filter(
                    FilterFieldOperator.GREATER_THAN_EQUAL,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.LESS_THAN: {
                if (negation) {
                    return new Filter(
                        FilterFieldOperator.GREATER_THAN_EQUAL,
                        left as string,
                        right as string,
                    );
                }
                return new Filter(
                    FilterFieldOperator.LESS_THAN,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.LESS_OR_EQUAL: {
                if (negation) {
                    return new Filter(
                        FilterFieldOperator.GREATER_THAN,
                        left as string,
                        right as string,
                    );
                }
                return new Filter(
                    FilterFieldOperator.LESS_THAN_EQUAL,
                    left as string,
                    right as string,
                );
            }
        }

        throw new Error(`Token type ${op} not supported as comparison operator.`);
    }

    private parseMatchExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ): Filters | Filter {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const field = this.parseExpressionFieldChain(scope);
        this.consume(FilterTokenType.COMMA);
        const text = this.consume(FilterTokenType.ESCAPED_TEXT).value!;
        this.consume(FilterTokenType.RPAREN);

        const normalized = this.normalizeValue(text);
        if (typeof normalized !== 'string') {
            throw new Error(`String expected for type ${op}.`);
        }

        if (negation) {
            // todo: decide if Not(Expr()) or Expr() aka negation constructor parameter
            throw new FiltersParseError('Negation of match expression is not supported.');
        }

        switch (op) {
            case FilterTokenType.CONTAINS: {
                return new Filter(
                    negation ?
                        FilterFieldOperator.NOT_CONTAINS :
                        FilterFieldOperator.CONTAINS,
                    field,
                    normalized,
                );
            }
            case FilterTokenType.ENDS_WITH: {
                return new Filter(
                    negation ?
                        FilterFieldOperator.NOT_ENDS_WITH :
                        FilterFieldOperator.ENDS_WITH,
                    field,
                    normalized,
                );
            }
            default: {
                return new Filter(
                    negation ?
                        FilterFieldOperator.NOT_STARTS_WITH :
                        FilterFieldOperator.STARTS_WITH,
                    field,
                    normalized,
                );
            }
        }
    }

    private parseInExpression(
        scope?: FiltersScope,
        negation: boolean = false,
    ): Filters | Filter {
        const token = this.peek();
        if (token.type === FilterTokenType.NIN) {
            this.consume(FilterTokenType.NIN);
        } else {
            this.consume(FilterTokenType.IN);
        }

        this.consume(FilterTokenType.LPAREN);

        const field = this.parseExpressionFieldChain(scope);

        const values: unknown[] = [];
        while (this.peek().type === FilterTokenType.COMMA) {
            this.consume(FilterTokenType.COMMA);

            values.push(this.parseExpressionValue());
        }
        this.consume(FilterTokenType.RPAREN);

        const notIn = (token.type === FilterTokenType.NIN && !negation) ||
            (token.type === FilterTokenType.IN && negation);

        if (notIn) {
            return new Filter(
                FilterFieldOperator.NOT_IN,
                field,
                values,
            );
        }

        return new Filter(
            FilterFieldOperator.IN,
            field,
            values,
        );
    }

    private parseExpressionValue(): Scalar {
        const token = this.consume();

        if (
            token.type !== FilterTokenType.ESCAPED_TEXT &&
            token.type !== FilterTokenType.NULL
        ) {
            throw new Error(`Unexpected token in value: ${token.type}`);
        }

        return this.normalizeValue(token.value ?? 'null');
    }

    private parseExpressionFieldChain(
        scope?: FiltersScope,
    ): string {
        const token = this.consume(FilterTokenType.FIELD);
        if (token.type !== FilterTokenType.FIELD) {
            throw new Error(`Unexpected token in value: ${token.type}`);
        }

        const parts = [token.value!];

        while (this.peek().type === FilterTokenType.FIELD) {
            parts.push(this.consume(FilterTokenType.FIELD).value!);
        }

        if (scope) {
            // a leading segment matching the schema name addresses the
            // schema itself (mirrors the named-group hoisting of the
            // simple filters parser) and is stripped.
            if (
                parts.length > 1 &&
                (parts[0] === DEFAULT_ID || parts[0] === scope.schema.name)
            ) {
                parts.shift();
            }

            const resolved = scope.resolveKey(parts.join('.'));

            /* istanbul ignore next -- the scope always throws */
            if (!resolved.success) {
                throw FiltersParseError.keyInvalid(resolved.input);
            }

            return [...resolved.path, resolved.name].join('.');
        }

        return parts.join('.');
    }

    // ---------------------------------------------------------

    protected normalizeValue(input: unknown) : Scalar {
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed.length === 0) {
                return trimmed;
            }

            if (
                input.startsWith('\'') &&
                input.endsWith('\'')
            ) {
                return this.normalizeValue(trimmed.slice(1, -1).replace(/''/g, '\''));
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

        if (typeof input === 'undefined' || input === null) {
            return null;
        }

        throw new SyntaxError('Value can not be normalized.');
    }
}
