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
    ErrorCode,
    FILTER_OPERATOR_SEMANTICS,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    ITSELF,
    MAX_TRAVERSAL_DEPTH,
    Parameter,
    ParseError,
    ResolutionScope,
    applyFiltersSchemaValidation,
    applyFiltersSchemaValidationAsync,
    buildFiltersDefaults,
    isFilter,
    isFilters,
} from '@rapiq/core';
import { parseFilterScalar } from '@rapiq/parser-simple';
import {
    FILTER_EXPRESSION_KEYWORDS,
    FILTER_FIELD_SEGMENT_PATTERN,
    FilterTokenType,
} from './constants';
import type { FilterToken } from './types';

type FiltersScope = ResolutionScope<`${Parameter.FILTERS}`>;

/**
 * Keep recursive expression parsing below the JavaScript call-stack limit and
 * aligned with the schema resolver and Mongo parser traversal caps.
 */
const MAX_DEPTH = MAX_TRAVERSAL_DEPTH;

/**
 * Bidirectional complement twins derived from the semantics table:
 * a not(…) around a single leaf normalizes to the leaf's twin
 * (not(eq) → ne, not(nin) → in) instead of a symbolic NOT node —
 * both lower to the identical plan, the twin is the canonical form.
 */
const COMPLEMENT_TWINS : Record<string, string> = {};
for (const [operator, semantics] of Object.entries(FILTER_OPERATOR_SEMANTICS)) {
    const twin = (semantics as { complementOf?: string }).complementOf;
    if (twin) {
        COMPLEMENT_TWINS[operator] = twin;
        COMPLEMENT_TWINS[twin] = operator;
    }
}

/**
 * @see https://www.jsonapi.net/usage/reading/filtering.html
 */
export class ExpressionFiltersParser extends BaseParser<
    FiltersParseOptions,
    IFilters
> {
    private tokens: FilterToken[] = [];

    private pos = 0;

    /**
     * How many elemMatch interiors the parser is currently inside —
     * the ITSELF marker is only legal at depth > 0.
     */
    private elemMatchDepth = 0;

    // ---------------------------------------------------------

    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        // absent input is not a failure — schema defaults still apply.
        // an empty string is NOT absent: the dialect is precise, so
        // input like `?filter=` must surface a syntax error.
        if (input === undefined || input === null) {
            return this.buildAbsentOutput(options);
        }

        return this.wrapRoot(this.parseExact(input, options));
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        if (input === undefined || input === null) {
            return this.buildAbsentOutput(options);
        }

        return this.wrapRoot(await this.parseExactAsync(input, options));
    }

    parseExact<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters | IFilter {
        const { expr, scope } = this.parseSource(input, options);
        if (!scope) {
            return expr;
        }

        const validated = applyFiltersSchemaValidation(expr, scope.schema, options.context);

        return validated ?? new Filters(
            FilterCompoundOperator.AND,
            buildFiltersDefaults(scope.schema),
        );
    }

    async parseExactAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters | IFilter> {
        const { expr, scope } = this.parseSource(input, options);
        if (!scope) {
            return expr;
        }

        const validated = await applyFiltersSchemaValidationAsync(expr, scope.schema, options.context);

        return validated ?? new Filters(
            FilterCompoundOperator.AND,
            buildFiltersDefaults(scope.schema),
        );
    }

    // ---------------------------------------------------------

    /**
     * The shared front-end of {@link parseExact} and
     * {@link parseExactAsync}: tokenize, bind the resolution scope and
     * run the grammar — everything up to (but excluding) validation.
     */
    private parseSource<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
    ) : { expr: Filters | Filter, scope?: FiltersScope } {
        if (typeof input !== 'string') {
            throw FiltersParseError.inputInvalid();
        }

        this.pos = 0;
        this.elemMatchDepth = 0;
        this.tokens = this.tokenize(input);

        // expressions are precise — invalid keys always throw,
        // but only when a schema (or the strict override,
        // which rejects undeclared keys) constrains the parse.
        let scope : FiltersScope | undefined;
        if (options.schema || options.strict) {
            scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
                relations: options.relations,
                throwOnFailure: true,
                strict: options.strict,
            }) as FiltersScope;
        }

        const expr = this.parseFilterExpression(scope);
        if (this.peek().type !== FilterTokenType.EOF) {
            throw FiltersParseError.syntaxInvalid(`Unexpected token: ${this.peek().type}`);
        }

        return { expr, scope };
    }

    private buildAbsentOutput<RECORD extends ObjectLiteral = ObjectLiteral>(
        options: FiltersParseOptions<RECORD>,
    ) : IFilters {
        const scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, { relations: options.relations }) as FiltersScope;

        return new Filters(
            FilterCompoundOperator.AND,
            buildFiltersDefaults(scope.schema),
        );
    }

    private wrapRoot(expr: IFilters | IFilter) : IFilters {
        if (
            isFilters(expr, FilterCompoundOperator.AND) ||
            isFilters(expr, FilterCompoundOperator.OR)
        ) {
            return expr;
        }

        return new Filters(FilterCompoundOperator.AND, [expr]);
    }

    // ---------------------------------------------------------

    private peek(): FilterToken {
        return this.tokens[this.pos] || { type: FilterTokenType.EOF };
    }

    private consume(expected?: `${FilterTokenType}`): FilterToken {
        const token = this.peek();
        if (expected && token.type !== expected) {
            throw FiltersParseError.syntaxInvalid(`Expected ${expected}, got ${token.type}`);
        }
        this.pos++;
        return token;
    }

    private tokenize(input: string): FilterToken[] {
        const tokens: FilterToken[] = [];
        // keywords are classified from whole identifiers (lookup below) —
        // matching them in the regex would split identifiers that merely
        // start with a keyword (e.g. "order" -> "or" + "der").
        // $-words are reserved markers, never field segments.
        const regex = new RegExp(`\\s+|\\(|\\)|,|\\.|'(?:''|[^'])*'|\\$[A-Za-z0-9_]*|${FILTER_FIELD_SEGMENT_PATTERN}`, 'g');

        let match: RegExpExecArray | null;
        let cursor = 0;

        while ((match = regex.exec(input))) {
            if (match.index !== cursor) {
                throw FiltersParseError.syntaxInvalid(`Unexpected character at position ${cursor}.`);
            }

            const value = match[0];
            cursor = regex.lastIndex;
            if (/^\s+$/.test(value)) continue;

            switch (value) {
                case '(': tokens.push({ type: FilterTokenType.LPAREN }); break;
                case ')': tokens.push({ type: FilterTokenType.RPAREN }); break;
                case ',': tokens.push({ type: FilterTokenType.COMMA }); break;
                case '.': tokens.push({ type: FilterTokenType.DOT }); break;
                default:
                    if (value.startsWith('$')) {
                        if (value !== ITSELF) {
                            throw FiltersParseError.syntaxInvalid(`The marker ${value} is unknown.`);
                        }

                        tokens.push({ type: FilterTokenType.ITSELF });
                        break;
                    }

                    // own-property check: exotic field names inherited from
                    // Object.prototype (toString, constructor, ...) stay fields.
                    if (Object.prototype.hasOwnProperty.call(FILTER_EXPRESSION_KEYWORDS, value)) {
                        tokens.push({ type: FILTER_EXPRESSION_KEYWORDS[value as keyof typeof FILTER_EXPRESSION_KEYWORDS] });
                    } else if (
                        value.startsWith('\'') &&
                        value.endsWith('\'')
                    ) {
                        tokens.push({ type: FilterTokenType.ESCAPED_TEXT, value });
                    } else {
                        tokens.push({ type: FilterTokenType.FIELD, value });
                    }
            }
        }

        if (cursor !== input.length) {
            throw FiltersParseError.syntaxInvalid(`Unexpected character at position ${cursor}.`);
        }

        tokens.push({ type: FilterTokenType.EOF });
        return tokens;
    }

    private parseFilterExpression(
        scope?: FiltersScope,
        depth: number = 0,
    ) : Filters | Filter {
        if (depth > MAX_DEPTH) {
            throw FiltersParseError.syntaxInvalid('The maximum nesting depth was exceeded.');
        }

        const token = this.peek();
        switch (token.type) {
            case FilterTokenType.NOT:
                return this.parseNotExpression(scope, depth);
            case FilterTokenType.AND:
            case FilterTokenType.OR:
                return this.parseLogicalExpression(scope, depth);
            case FilterTokenType.EQUAL:
            case FilterTokenType.GREATER_THAN:
            case FilterTokenType.GREATER_OR_EQUAL:
            case FilterTokenType.LESS_THAN:
            case FilterTokenType.LESS_OR_EQUAL:
                return this.parseComparisonExpression(scope);
            case FilterTokenType.CONTAINS:
            case FilterTokenType.STARTS_WITH:
            case FilterTokenType.ENDS_WITH:
                return this.parseMatchExpression(scope);
            case FilterTokenType.IN:
            case FilterTokenType.NIN:
                return this.parseInExpression(scope);
            case FilterTokenType.ELEM_MATCH:
                return this.parseElemMatchExpression(scope, depth);
            case FilterTokenType.SIZE:
                return this.parseSizeExpression(scope);
            default:
                throw FiltersParseError.syntaxInvalid(`Unexpected token in filter expression: ${token.type}`);
        }
    }

    /**
     * not(expr): the exact complement of the interior (null-inclusive
     * complement law). A single leaf with a complement twin normalizes
     * to the twin, a double negation cancels; everything else stays a
     * first-class NOT node.
     */
    private parseNotExpression(
        scope?: FiltersScope,
        depth: number = 0,
    ): Filters | Filter {
        this.consume(FilterTokenType.NOT);
        this.consume(FilterTokenType.LPAREN);
        const expr = this.parseFilterExpression(scope, depth + 1);
        this.consume(FilterTokenType.RPAREN);

        if (isFilter(expr)) {
            const twin = COMPLEMENT_TWINS[expr.operator];
            if (twin) {
                return new Filter(twin as FilterFieldOperator, expr.field, expr.value);
            }
        }

        if (
            isFilters(expr, FilterCompoundOperator.NOT) &&
            expr.value.length === 1
        ) {
            return expr.value[0] as Filters | Filter;
        }

        return new Filters(FilterCompoundOperator.NOT, [expr]);
    }

    private parseLogicalExpression(
        scope?: FiltersScope,
        depth: number = 0,
    ): Filters | Filter {
        const op = this.consume().type; // AND / OR
        if (op !== FilterTokenType.AND && op !== FilterTokenType.OR) {
            throw FiltersParseError.syntaxInvalid('Expected AND or OR token type.');
        }

        this.consume(FilterTokenType.LPAREN);
        const expressions: (Filter | Filters)[] = [this.parseFilterExpression(scope, depth + 1)];
        while (this.peek().type === FilterTokenType.COMMA) {
            this.consume(FilterTokenType.COMMA);
            expressions.push(this.parseFilterExpression(scope, depth + 1));
        }
        this.consume(FilterTokenType.RPAREN);

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
    ): Filters | Filter {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const left = this.parseExpressionFieldChain(scope);
        this.consume(FilterTokenType.COMMA);
        const right = this.parseExpressionValue();
        this.consume(FilterTokenType.RPAREN);

        switch (op) {
            case FilterTokenType.EQUAL: {
                return new Filter(
                    FilterFieldOperator.EQUAL,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.GREATER_THAN: {
                return new Filter(
                    FilterFieldOperator.GREATER_THAN,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.GREATER_OR_EQUAL: {
                return new Filter(
                    FilterFieldOperator.GREATER_THAN_EQUAL,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.LESS_THAN: {
                return new Filter(
                    FilterFieldOperator.LESS_THAN,
                    left as string,
                    right as string,
                );
            }
            case FilterTokenType.LESS_OR_EQUAL: {
                return new Filter(
                    FilterFieldOperator.LESS_THAN_EQUAL,
                    left as string,
                    right as string,
                );
            }
        }

        throw FiltersParseError.syntaxInvalid(`Token type ${op} not supported as comparison operator.`);
    }

    private parseMatchExpression(
        scope?: FiltersScope,
    ): Filters | Filter {
        const op = this.consume().type;
        this.consume(FilterTokenType.LPAREN);
        const field = this.parseExpressionFieldChain(scope);
        this.consume(FilterTokenType.COMMA);
        const text = this.consume(FilterTokenType.ESCAPED_TEXT).value!;
        this.consume(FilterTokenType.RPAREN);

        const normalized = this.normalizeValue(text);
        if (typeof normalized !== 'string') {
            throw FiltersParseError.keyValueInvalid(field);
        }

        switch (op) {
            case FilterTokenType.CONTAINS: {
                return new Filter(
                    FilterFieldOperator.CONTAINS,
                    field,
                    normalized,
                );
            }
            case FilterTokenType.ENDS_WITH: {
                return new Filter(
                    FilterFieldOperator.ENDS_WITH,
                    field,
                    normalized,
                );
            }
            default: {
                return new Filter(
                    FilterFieldOperator.STARTS_WITH,
                    field,
                    normalized,
                );
            }
        }
    }

    private parseInExpression(
        scope?: FiltersScope,
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

        if (token.type === FilterTokenType.NIN) {
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

    /**
     * size(field, n): the field holds an array of exactly n elements
     * (a non-negative integer — the wire is untyped, so the quoted
     * value coerces back to a number).
     */
    private parseSizeExpression(
        scope?: FiltersScope,
    ): Filter {
        this.consume(FilterTokenType.SIZE);
        this.consume(FilterTokenType.LPAREN);
        const field = this.parseExpressionFieldChain(scope);
        this.consume(FilterTokenType.COMMA);
        const value = this.parseExpressionValue();
        this.consume(FilterTokenType.RPAREN);

        if (
            typeof value !== 'number' ||
            !Number.isInteger(value) ||
            value < 0
        ) {
            throw FiltersParseError.keyValueInvalid(field);
        }

        return new Filter(FilterFieldOperator.SIZE, field, value);
    }

    /**
     * elemMatch(field, expr): field paths inside the interior are
     * relative to the array element; the ITSELF marker addresses the
     * element itself.
     */
    private parseElemMatchExpression(
        scope?: FiltersScope,
        depth: number = 0,
    ): Filter {
        this.consume(FilterTokenType.ELEM_MATCH);
        this.consume(FilterTokenType.LPAREN);

        const target = this.parseElemMatchTarget(scope);

        this.consume(FilterTokenType.COMMA);

        this.elemMatchDepth += 1;

        let condition : Filters | Filter;
        try {
            condition = this.parseFilterExpression(target.scope, depth + 1);
        } finally {
            this.elemMatchDepth -= 1;
        }

        this.consume(FilterTokenType.RPAREN);

        return new Filter(FilterFieldOperator.ELEM_MATCH, target.field, condition);
    }

    /**
     * The field an elemMatch binds plus the interior resolution scope:
     * the related schema when resolvable, otherwise an unbound scope
     * inheriting the current policy (e.g. a JSON array column).
     */
    private parseElemMatchTarget(
        scope?: FiltersScope,
    ): { field: string, scope?: FiltersScope } {
        if (this.peek().type === FilterTokenType.ITSELF) {
            // an elemMatch on the element itself (arrays of arrays);
            // the chain parser enforces the interior-only contract.
            const field = this.parseExpressionFieldChain(scope);

            return {
                field,
                scope: scope ? this.buildUnboundScope(scope) : undefined,
            };
        }

        const token = this.consume(FilterTokenType.FIELD);

        const parts = [token.value!];
        while (this.peek().type === FilterTokenType.DOT) {
            this.consume(FilterTokenType.DOT);
            parts.push(this.consume(FilterTokenType.FIELD).value!);
        }

        if (!scope) {
            return { field: parts.join('.') };
        }

        // a leading segment matching the schema name addresses the
        // schema itself (mirrors parseExpressionFieldChain).
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

        const field = [...resolved.path, resolved.name].join('.');

        let interior : FiltersScope | undefined;
        try {
            const verdict = resolved.scope.descend(resolved.name);
            if (verdict instanceof ResolutionScope) {
                interior = verdict as FiltersScope;
            }
        } catch (e) {
            // elemMatch on a non-relation field is legal — a missing
            // related schema (thrown as keyPathInvalid, the scope is
            // always throwing) falls back to the unbound scope; every
            // other failure (e.g. relations gating) propagates.
            if (
                !(e instanceof ParseError) ||
                e.code !== ErrorCode.KEY_PATH_INVALID
            ) {
                throw e;
            }
        }

        return {
            field,
            scope: interior ?? this.buildUnboundScope(scope),
        };
    }

    private buildUnboundScope(current: FiltersScope) : FiltersScope {
        return ResolutionScope.for(this.registry, Parameter.FILTERS, undefined, {
            throwOnFailure: true,
            strict: current.strict,
        }) as FiltersScope;
    }

    private parseExpressionValue(): Scalar {
        const token = this.consume();

        if (
            token.type !== FilterTokenType.ESCAPED_TEXT &&
            token.type !== FilterTokenType.NULL
        ) {
            throw FiltersParseError.syntaxInvalid(`Unexpected token in value: ${token.type}`);
        }

        return this.normalizeValue(token.value ?? 'null');
    }

    private parseExpressionFieldChain(
        scope?: FiltersScope,
    ): string {
        if (this.peek().type === FilterTokenType.ITSELF) {
            this.consume(FilterTokenType.ITSELF);

            // the marker addresses the element bound by the enclosing
            // elemMatch interior and never resolves against the schema.
            if (this.elemMatchDepth === 0) {
                throw FiltersParseError.keyInvalid(ITSELF);
            }

            return ITSELF;
        }

        const token = this.consume(FilterTokenType.FIELD);
        if (token.type !== FilterTokenType.FIELD) {
            throw FiltersParseError.syntaxInvalid(`Unexpected token in field chain: ${token.type}`);
        }

        const parts = [token.value!];

        while (this.peek().type === FilterTokenType.DOT) {
            this.consume(FilterTokenType.DOT);
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

            // quoted content is coerced but never comma-split —
            // the expression dialect passes lists as separate args.
            if (
                trimmed.startsWith('\'') &&
                trimmed.endsWith('\'') &&
                trimmed.length >= 2
            ) {
                return parseFilterScalar(trimmed.slice(1, -1).replace(/''/g, '\''));
            }

            return parseFilterScalar(trimmed);
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
