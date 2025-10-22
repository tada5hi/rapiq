/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Condition,
    FiltersParseOptions, FiltersSchema, ObjectLiteral, Scalar,
} from 'rapiq';
import {
    BaseFiltersParser,
    DEFAULT_ID,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    FilterRegexFlag,
    Filters,
    FiltersParseError,
    createFilterRegex,
    escapeRegExp,
    isPathAllowed,
    isPropertyNameValid,
} from 'rapiq';
import { FilterTokenType } from './constants';
import type { FilterExpressionParseOptions, FilterToken } from './types';

/**
 * @see https://www.jsonapi.net/usage/reading/filtering.html
 */
export class ExpressionFiltersParser extends BaseFiltersParser<
FiltersParseOptions
> {
    private tokens: FilterToken[] = [];

    private pos = 0;

    // ---------------------------------------------------------

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Condition {
        if (typeof input !== 'string') {
            throw FiltersParseError.inputInvalid();
        }

        this.pos = 0;
        this.tokens = this.tokenize(input);

        const expr = this.parseFilterExpression(options);
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
        const regex = /\s+|and|or|eq|ne|gte|gt|lte|lt|like|startsWith|endsWith|nin|in|null|\(|\)|,|'(?:''|[^'])*'|[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?/g;

        let match: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
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
                case 'like': tokens.push({ type: FilterTokenType.CONTAINS }); break;
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

    private parseFilterExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        const token = this.peek();
        switch (token.type) {
            case FilterTokenType.NOT:
                return this.parseNotExpression(options, negation);
            case FilterTokenType.AND:
            case FilterTokenType.OR:
                return this.parseLogicalExpression(options, negation);
            case FilterTokenType.EQUAL:
            case FilterTokenType.GREATER_THAN:
            case FilterTokenType.GREATER_OR_EQUAL:
            case FilterTokenType.LESS_THAN:
            case FilterTokenType.LESS_OR_EQUAL:
                return this.parseComparisonExpression(options, negation);
            case FilterTokenType.CONTAINS:
            case FilterTokenType.STARTS_WITH:
            case FilterTokenType.ENDS_WITH:
                return this.parseMatchExpression(options, negation);
            case FilterTokenType.IN:
            case FilterTokenType.NIN:
                return this.parseInExpression(options, negation);
            default:
                throw new Error(`Unexpected token in filterExpression: ${token.type}`);
        }
    }

    private parseNotExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        this.consume(FilterTokenType.NOT);
        this.consume(FilterTokenType.LPAREN);
        const expr = this.parseFilterExpression(options, !negation);
        this.consume(FilterTokenType.RPAREN);

        return expr;
    }

    private parseLogicalExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        let op = this.consume().type; // AND / OR
        if (op !== FilterTokenType.AND && op !== FilterTokenType.OR) {
            throw new Error('Expected AND or OR token type.');
        }

        this.consume(FilterTokenType.LPAREN);
        const expressions: Condition[] = [this.parseFilterExpression(options, negation)];
        while (this.peek().type === FilterTokenType.COMMA) {
            this.consume(FilterTokenType.COMMA);
            expressions.push(this.parseFilterExpression(options, negation));
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

    private parseComparisonExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const left = this.parseExpressionFieldChain(options);
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

    private parseMatchExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const field = this.parseExpressionFieldChain(options);
        this.consume(FilterTokenType.COMMA);
        const text = this.consume(FilterTokenType.ESCAPED_TEXT).value!;
        this.consume(FilterTokenType.RPAREN);

        const normalized = this.normalizeValue(text);
        if (typeof normalized !== 'string') {
            throw new Error(`String expected for type ${op}.`);
        }

        let flag : number = 0;

        if (negation) {
            flag |= FilterRegexFlag.NEGATION;
        }

        if (op === FilterTokenType.CONTAINS || op === FilterTokenType.STARTS_WITH) {
            flag |= FilterRegexFlag.STARTS_WITH;
        }

        if (op === FilterTokenType.CONTAINS || op === FilterTokenType.ENDS_WITH) {
            flag |= FilterRegexFlag.ENDS_WITH;
        }

        return new Filter(
            FilterFieldOperator.REGEX,
            field,
            createFilterRegex(
                escapeRegExp(normalized),
                flag,
            ),
        );
    }

    private parseInExpression<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD> = {},
        negation: boolean = false,
    ): Condition {
        const token = this.peek();
        if (token.type === FilterTokenType.NIN) {
            this.consume(FilterTokenType.NIN);
        } else {
            this.consume(FilterTokenType.IN);
        }

        this.consume(FilterTokenType.LPAREN);

        const field = this.parseExpressionFieldChain(options);

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

    private parseExpressionFieldChain<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FilterExpressionParseOptions<RECORD> = {},
    ): string {
        const token = this.consume(FilterTokenType.FIELD);
        if (token.type !== FilterTokenType.FIELD) {
            throw new Error(`Unexpected token in value: ${token.type}`);
        }

        const parts = [token.value!];

        while (this.peek().type === FilterTokenType.FIELD) {
            parts.push(this.consume(FilterTokenType.FIELD).value!);
        }

        if (options.schema) {
            let { relations } = options;
            let schema : FiltersSchema<ObjectLiteral> = this.resolveSchema(options.schema);

            // [ 'id' ]
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];

                if (i === 0 && (part === DEFAULT_ID || schema.name)) {
                    continue;
                }

                if (!isPathAllowed(part, relations)) {
                    throw FiltersParseError.keyPathInvalid(part);
                }

                const root = this.registry.resolve(schema.name, part);
                if (root) {
                    schema = root.filters;
                } else if (typeof relations !== 'undefined') {
                    throw FiltersParseError.keyPathInvalid(part);
                }

                if (typeof relations !== 'undefined') {
                    relations = relations.extract(part);
                }
            }

            const key = parts[parts.length - 1];

            if (
                schema.allowedIsUndefined &&
                !isPropertyNameValid(key)
            ) {
                throw FiltersParseError.keyInvalid(key);
            }

            if (
                !schema.allowedIsUndefined &&
                schema.allowed.indexOf(key) === -1
            ) {
                throw FiltersParseError.keyInvalid(key);
            }
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
