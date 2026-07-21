/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    FiltersParseOptions,
    ICondition,
    IFilters,
    ObjectLiteral,
} from '@rapiq/core';
import {
    BaseParser,
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    ITSELF,
    KeyResolutionErrorCode,
    MAX_TRAVERSAL_DEPTH,
    Parameter,
    ParseError,
    ResolutionScope,
    applyFiltersSchemaValidation,
    applyFiltersSchemaValidationAsync,
    buildFiltersDefaults,
    isFilters,
    isObject,
} from '@rapiq/core';
import type { MongoComparisonOperator, MongoCompoundOperator } from './constants';
import {
    MONGO_COMPARISON_OPERATORS,
    MONGO_COMPOUND_OPERATORS,
    MONGO_FIELD_OPERATORS,
    MONGO_UNSUPPORTED_OPERATORS,
} from './constants';
import type { MongoFiltersParserInput } from './types';

type FiltersScope = ResolutionScope<`${Parameter.FILTERS}`>;

type FieldResolution = {
    field: string,
    name: string,
    scope: FiltersScope,
};

/**
 * Nesting cap for document/compound/field recursion (mirrors the
 * resolver's traversal cap): beyond it a crafted deeply nested JSON
 * body would escape as an untyped stack overflow instead of a
 * grammar error.
 */
const MAX_DEPTH = MAX_TRAVERSAL_DEPTH;

/**
 * Parses MongoDB-style filter documents into the rapiq Filters AST.
 *
 * The dialect enforces a two-class failure model: grammar errors
 * (unknown or misplaced operators, malformed operator arguments,
 * invalid compound arrays) always throw, independent of the schema
 * failure policy; field-key/allow-list failures follow the schema
 * policy — drop by default, throw under throwOnFailure.
 *
 * @see https://www.mongodb.com/docs/manual/reference/operator/query/
 */
export class MongoFiltersParser extends BaseParser<
    FiltersParseOptions,
    IFilters
> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        const { scope, parsed } = this.prepare(input, options);
        if (!parsed) {
            return this.buildDefaultOutput(scope);
        }

        const validated = applyFiltersSchemaValidation(parsed, scope.schema, options.context);
        if (!validated) {
            return this.buildDefaultOutput(scope);
        }

        return validated as IFilters;
    }

    override async parseAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        const { scope, parsed } = this.prepare(input, options);
        if (!parsed) {
            return this.buildDefaultOutput(scope);
        }

        const validated = await applyFiltersSchemaValidationAsync(parsed, scope.schema, options.context);
        if (!validated) {
            return this.buildDefaultOutput(scope);
        }

        return validated as IFilters;
    }

    parseTyped<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: MongoFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : IFilters {
        return this.parse(input, options);
    }

    parseTypedAsync<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: MongoFiltersParserInput<RECORD>,
        options: FiltersParseOptions<RECORD> = {},
    ) : Promise<IFilters> {
        return this.parseAsync(input, options);
    }

    // ---------------------------------------------------------

    /**
     * The shared front-end of {@link parse} and {@link parseAsync}:
     * scope construction, grammar/policy guards and the document walk —
     * everything up to (but excluding) validation. `parsed: null`
     * signals "fall back to the schema defaults".
     */
    private prepare<RECORD extends ObjectLiteral = ObjectLiteral>(
        input: unknown,
        options: FiltersParseOptions<RECORD>,
    ) : { scope: FiltersScope, parsed: IFilters | null } {
        const scope = ResolutionScope.for(this.registry, Parameter.FILTERS, options.schema, {
            relations: options.relations,
            throwOnFailure: options.throwOnFailure,
            strict: options.strict,
        }) as FiltersScope;

        // absent input is not a failure — schema defaults still apply.
        if (typeof input === 'undefined' || input === null) {
            return { scope, parsed: null };
        }

        // the dialect travels as a JSON document — anything that is not
        // a plain object is a grammar error, independent of policy.
        if (!isPlainObject(input)) {
            throw FiltersParseError.inputInvalid();
        }

        // if allowed is an empty array nothing is permitted — the input
        // is not walked and only the schema defaults apply.
        if (
            !scope.schema.allowedIsUndefined &&
            scope.schema.allowed.length === 0
        ) {
            return { scope, parsed: null };
        }

        const conditions = this.parseDocument(input, scope, false, 0);
        if (conditions.length === 0) {
            return { scope, parsed: null };
        }

        // An explicit root compound is returned as-is; everything else wraps
        // in a root AND. Validation runs over that final tree so replacement
        // and rejection semantics are identical across parser dialects.
        const [first] = conditions;
        const parsed = conditions.length === 1 && first && isFilters(first) ?
            first :
            new Filters(FilterCompoundOperator.AND, conditions);

        return { scope, parsed };
    }

    private buildDefaultOutput(scope: FiltersScope) : IFilters {
        return new Filters(
            FilterCompoundOperator.AND,
            buildFiltersDefaults(scope.schema),
        );
    }

    // ---------------------------------------------------------

    /**
     * Parse a document object (the root, a compound child or an
     * $elemMatch interior). Multiple entries are an implicit AND —
     * under negation the implicit AND becomes an OR (De Morgan);
     * the combination itself is owned by the caller.
     */
    protected parseDocument(
        input: Record<string, any>,
        scope: FiltersScope,
        negated: boolean,
        depth: number,
    ) : ICondition[] {
        if (depth > MAX_DEPTH) {
            throw FiltersParseError.syntaxInvalid('The maximum nesting depth was exceeded.');
        }

        const output : ICondition[] = [];

        const keys = Object.keys(input);
        for (const key of keys) {
            if (isMongoCompoundOperator(key)) {
                const compound = this.parseCompound(key, input[key], scope, negated, depth);
                if (compound) {
                    output.push(compound);
                }

                continue;
            }

            // a $-prefixed key is never a field name.
            if (key.startsWith('$')) {
                throw this.buildDocumentOperatorError(key);
            }

            output.push(...this.parseFieldEntry(key, input[key], scope, negated, depth));
        }

        return output;
    }

    protected buildDocumentOperatorError(key: string) : FiltersParseError {
        if (MONGO_FIELD_OPERATORS.includes(key)) {
            return FiltersParseError.syntaxInvalid(
                `The field operator ${key} is not permitted at document level.`,
            );
        }

        if (MONGO_UNSUPPORTED_OPERATORS.includes(key)) {
            return FiltersParseError.operatorUnsupported(key);
        }

        return FiltersParseError.syntaxInvalid(`The operator ${key} is unknown.`);
    }

    /**
     * Parse an explicit compound ($and/$or/$nor). Compounds are always
     * materialized — no single-child unwrapping, no cross-level
     * flattening. $nor desugars per De Morgan: an AND of negated
     * children (an OR of children when itself negated).
     */
    protected parseCompound(
        key: MongoCompoundOperator,
        input: unknown,
        scope: FiltersScope,
        negated: boolean,
        depth: number,
    ) : ICondition | undefined {
        if (!Array.isArray(input) || input.length === 0) {
            throw FiltersParseError.syntaxInvalid(
                `The value of the operator ${key} must be a non-empty array.`,
            );
        }

        const childNegated = key === '$nor' ? !negated : negated;

        let operator : `${FilterCompoundOperator}`;
        if (key === '$or') {
            operator = negated ?
                FilterCompoundOperator.AND :
                FilterCompoundOperator.OR;
        } else {
            // $and and $nor share the same effective operator.
            operator = negated ?
                FilterCompoundOperator.OR :
                FilterCompoundOperator.AND;
        }

        const children : ICondition[] = [];
        for (const element of input) {
            if (
                !isPlainObject(element) ||
                Object.keys(element).length === 0
            ) {
                throw FiltersParseError.syntaxInvalid(
                    `The children of the operator ${key} must be non-empty objects.`,
                );
            }

            const conditions = this.parseDocument(element, scope, childNegated, depth + 1);

            // children dropped by the schema policy are skipped.
            const condition = this.combineDocument(conditions, childNegated);
            if (condition) {
                children.push(condition);
            }
        }

        if (children.length === 0) {
            return undefined;
        }

        return new Filters(operator, children);
    }

    /**
     * Combine the conditions of one document into a single condition:
     * none → nothing, one → unwrapped, several → an implicit AND
     * (an OR under negation).
     */
    protected combineDocument(
        conditions: ICondition[],
        negated: boolean,
    ) : ICondition | undefined {
        if (conditions.length === 0) {
            return undefined;
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        return new Filters(
            negated ?
                FilterCompoundOperator.OR :
                FilterCompoundOperator.AND,
            conditions,
        );
    }

    // ---------------------------------------------------------

    /**
     * Parse one `key: value` field entry. The key may be dotted.
     * Grammar (operator vocabulary & value shapes) is validated first
     * and always throws; the field key is resolved second and follows
     * the schema failure policy.
     */
    protected parseFieldEntry(
        key: string,
        value: unknown,
        scope: FiltersScope,
        negated: boolean,
        depth: number,
    ) : ICondition[] {
        if (depth > MAX_DEPTH) {
            throw FiltersParseError.syntaxInvalid('The maximum nesting depth was exceeded.');
        }

        if (isPlainObject(value)) {
            const keys = Object.keys(value);

            // mongo's exact-empty-document match is inexpressible —
            // silently dropping a client-sent condition would widen
            // the result set.
            if (keys.length === 0) {
                throw FiltersParseError.keyValueInvalid(key);
            }

            const operators = keys.filter((child) => child.startsWith('$'));

            if (operators.length === keys.length) {
                return this.parseOperatorObject(key, value, scope, negated, depth);
            }

            if (operators.length > 0) {
                throw FiltersParseError.syntaxInvalid(
                    `The value of the key ${key} mixes operator and field keys.`,
                );
            }

            // nested plain objects expand to dotted key paths
            // (deviation from mongo's exact-embedded-document match).
            const output : ICondition[] = [];
            for (const child of keys) {
                output.push(...this.parseFieldEntry(
                    `${key}.${child}`,
                    value[child],
                    scope,
                    negated,
                    depth + 1,
                ));
            }

            return output;
        }

        // bare RegExp desugars to $regex — which has no negated form.
        if (value instanceof RegExp) {
            if (negated) {
                throw FiltersParseError.operatorUnsupported('$regex');
            }

            return this.buildLeaf(key, scope, FilterFieldOperator.REGEX, value);
        }

        // bare array desugars to $in
        // (deviation from mongo's exact-array match).
        if (Array.isArray(value)) {
            this.validateInValue(key, value);

            return this.buildLeaf(
                key,
                scope,
                negated ?
                    FilterFieldOperator.NOT_IN :
                    FilterFieldOperator.IN,
                value,
            );
        }

        // bare scalar, null or Date desugars to $eq.
        if (isComparableValue(value)) {
            return this.buildLeaf(
                key,
                scope,
                negated ?
                    FilterFieldOperator.NOT_EQUAL :
                    FilterFieldOperator.EQUAL,
                value,
            );
        }

        throw FiltersParseError.keyValueInvalid(key);
    }

    protected buildLeaf(
        key: string,
        scope: FiltersScope,
        operator: `${FilterFieldOperator}`,
        value: unknown,
    ) : ICondition[] {
        const resolved = this.resolveField(key, scope);
        if (!resolved) {
            return [];
        }

        return [new Filter(operator, resolved.field, value)];
    }

    /**
     * Resolve a (possibly dotted) field key against the scope.
     * Returns undefined when the entry is dropped by the schema policy —
     * under throwOnFailure the scope itself has already thrown.
     */
    protected resolveField(
        key: string,
        scope: FiltersScope,
    ) : FieldResolution | undefined {
        const resolved = scope.resolveKey(key);
        if (!resolved.success) {
            return undefined;
        }

        return {
            field: [...resolved.path, resolved.name].join('.'),
            name: resolved.name,
            scope: resolved.scope,
        };
    }

    // ---------------------------------------------------------

    /**
     * Parse an operator object (all own keys $-prefixed). The field is
     * resolved once; every operator reuses the resolution. Multiple
     * operators combine through the enclosing document.
     */
    protected parseOperatorObject(
        key: string,
        input: Record<string, any>,
        scope: FiltersScope,
        negated: boolean,
        depth: number,
    ) : ICondition[] {
        // grammar first — always throws, independent of policy.
        const regex = this.validateOperatorObject(key, input, negated);

        // field resolution second — follows the schema policy;
        // a dropped field drops the whole entry/subtree.
        const resolved = this.resolveField(key, scope);
        if (!resolved) {
            return [];
        }

        return this.buildOperatorObject(input, resolved, negated, depth, regex);
    }

    /**
     * Validate the operator vocabulary & value shapes of an operator
     * object. Returns the RegExp a $regex entry desugars to.
     */
    protected validateOperatorObject(
        key: string,
        input: Record<string, any>,
        negated: boolean,
    ) : RegExp | undefined {
        const keys = Object.keys(input);

        // $options is only legal beside a string-valued $regex.
        if (keys.includes('$options') && !keys.includes('$regex')) {
            throw FiltersParseError.syntaxInvalid(
                `The operator $options of the key ${key} requires a $regex sibling.`,
            );
        }

        let regex : RegExp | undefined;

        for (const operator of keys) {
            if (isMongoCompoundOperator(operator)) {
                throw FiltersParseError.syntaxInvalid(
                    `The compound operator ${operator} is not permitted at field level.`,
                );
            }

            if (MONGO_UNSUPPORTED_OPERATORS.includes(operator)) {
                throw FiltersParseError.operatorUnsupported(operator);
            }

            switch (operator) {
                case '$eq':
                case '$ne': {
                    if (!isComparableValue(input[operator])) {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$lt':
                case '$lte':
                case '$gt':
                case '$gte': {
                    if (!isOrderableValue(input[operator])) {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$in':
                case '$nin': {
                    this.validateInValue(key, input[operator]);

                    break;
                }
                case '$startsWith':
                case '$notStartsWith':
                case '$endsWith':
                case '$notEndsWith':
                case '$contains':
                case '$notContains': {
                    if (typeof input[operator] !== 'string') {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$regex': {
                    regex = this.validateRegex(key, input, negated);

                    break;
                }
                case '$options': {
                    if (typeof input[operator] !== 'string') {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$mod': {
                    if (negated) {
                        throw FiltersParseError.operatorUnsupported('$mod');
                    }

                    const value = input[operator];
                    if (
                        !Array.isArray(value) ||
                        value.length !== 2 ||
                        typeof value[0] !== 'number' ||
                        typeof value[1] !== 'number' ||
                        value[0] === 0
                    ) {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$size': {
                    // no complement twin — negated $size can not be
                    // expressed without silently widening.
                    if (negated) {
                        throw FiltersParseError.operatorUnsupported('$size');
                    }

                    const value = input[operator];
                    if (
                        typeof value !== 'number' ||
                        !Number.isInteger(value) ||
                        value < 0
                    ) {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$exists': {
                    if (typeof input[operator] !== 'boolean') {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$elemMatch': {
                    if (negated) {
                        throw FiltersParseError.operatorUnsupported('$elemMatch');
                    }

                    // a match-all elemMatch ({}) is inexpressible.
                    if (
                        !isPlainObject(input[operator]) ||
                        Object.keys(input[operator]).length === 0
                    ) {
                        throw FiltersParseError.keyValueInvalid(key);
                    }

                    break;
                }
                case '$all': {
                    // no complement twin — negated $all can not be
                    // expressed without silently widening.
                    if (negated) {
                        throw FiltersParseError.operatorUnsupported('$all');
                    }

                    this.validateInValue(key, input[operator]);

                    break;
                }
                case '$not': {
                    if (negated) {
                        throw FiltersParseError.syntaxInvalid(
                            'The operator $not can not be nested or negated.',
                        );
                    }

                    const value = input[operator];

                    // mongo's $not: /re/ shorthand — regex is non-negatable.
                    if (value instanceof RegExp) {
                        throw FiltersParseError.operatorUnsupported('$regex');
                    }

                    if (
                        !isPlainObject(value) ||
                        Object.keys(value).length === 0
                    ) {
                        throw FiltersParseError.syntaxInvalid(
                            `The value of the operator $not of the key ${key} must be a non-empty object of field operators.`,
                        );
                    }

                    this.validateOperatorObject(key, value, true);

                    break;
                }
                default:
                    throw FiltersParseError.syntaxInvalid(
                        `The operator ${operator} is unknown.`,
                    );
            }
        }

        return regex;
    }

    protected validateRegex(
        key: string,
        input: Record<string, any>,
        negated: boolean,
    ) : RegExp {
        // regex has no negated counterpart.
        if (negated) {
            throw FiltersParseError.operatorUnsupported('$regex');
        }

        const value = input.$regex;
        if (value instanceof RegExp) {
            // mongo rejects $options beside a RegExp-valued $regex.
            if (typeof input.$options !== 'undefined') {
                throw FiltersParseError.syntaxInvalid(
                    `The operator $options of the key ${key} can not be combined with a RegExp valued $regex.`,
                );
            }

            return value;
        }

        if (typeof value !== 'string') {
            throw FiltersParseError.keyValueInvalid(key);
        }

        let flags = '';
        if (typeof input.$options !== 'undefined') {
            if (typeof input.$options !== 'string') {
                throw FiltersParseError.keyValueInvalid(key);
            }

            flags = input.$options;
        }

        try {
            return new RegExp(value, flags);
        } catch {
            throw FiltersParseError.keyValueInvalid(key);
        }
    }

    protected validateInValue(key: string, input: unknown) : void {
        if (!Array.isArray(input) || input.length === 0) {
            throw FiltersParseError.keyValueInvalid(key);
        }

        for (const element of input) {
            if (!isComparableValue(element)) {
                throw FiltersParseError.keyValueInvalid(key);
            }
        }
    }

    /**
     * Build the conditions of a validated operator object.
     */
    protected buildOperatorObject(
        input: Record<string, any>,
        resolved: FieldResolution,
        negated: boolean,
        depth: number,
        regex?: RegExp,
    ) : ICondition[] {
        const output : ICondition[] = [];

        const keys = Object.keys(input);
        for (const operator of keys) {
            if (isMongoComparisonOperator(operator)) {
                const [base, flipped] = MONGO_COMPARISON_OPERATORS[operator];

                output.push(new Filter(
                    negated ? flipped : base,
                    resolved.field,
                    input[operator],
                ));

                continue;
            }

            switch (operator) {
                case '$regex': {
                    output.push(new Filter(
                        FilterFieldOperator.REGEX,
                        resolved.field,
                        regex as RegExp,
                    ));

                    break;
                }
                case '$options': {
                    // modifier — consumed by the $regex entry.
                    break;
                }
                case '$mod': {
                    output.push(new Filter(
                        FilterFieldOperator.MOD,
                        resolved.field,
                        input[operator],
                    ));

                    break;
                }
                case '$size': {
                    output.push(new Filter(
                        FilterFieldOperator.SIZE,
                        resolved.field,
                        input[operator],
                    ));

                    break;
                }
                case '$exists': {
                    output.push(new Filter(
                        FilterFieldOperator.EXISTS,
                        resolved.field,
                        negated ? !input[operator] : input[operator],
                    ));

                    break;
                }
                case '$elemMatch': {
                    const condition = this.buildElemMatch(input[operator], resolved, depth);
                    if (condition) {
                        output.push(condition);
                    }

                    break;
                }
                case '$all': {
                    // for each listed value some element must equal it —
                    // an AND of independently scoped element matches.
                    for (const element of input[operator]) {
                        output.push(new Filter(
                            FilterFieldOperator.ELEM_MATCH,
                            resolved.field,
                            new Filter(FilterFieldOperator.EQUAL, ITSELF, element),
                        ));
                    }

                    break;
                }
                case '$not': {
                    const conditions = this.buildOperatorObject(
                        input[operator],
                        resolved,
                        !negated,
                        depth,
                    );

                    // the conditions of one negated operator object are
                    // OR-combined locally — the enclosing document
                    // combines with AND.
                    const condition = this.combineDocument(conditions, !negated);
                    if (condition) {
                        output.push(condition);
                    }

                    break;
                }
                /* istanbul ignore next -- validation rejected everything else */
                default:
                    break;
            }
        }

        return output;
    }

    /**
     * Build an $elemMatch condition. A field-operator interior
     * (`{ $gt: 5 }`) is the element-level form — the operators apply to
     * the array element itself, referenced by the ITSELF marker. Any
     * other value re-enters document context, fields relative to the
     * array element. The document-form interior scope is the related
     * schema when resolvable, otherwise an unbound scope inheriting the
     * current policy (e.g. a JSON array column).
     */
    protected buildElemMatch(
        input: Record<string, any>,
        resolved: FieldResolution,
        depth: number,
    ) : ICondition | undefined {
        if (depth > MAX_DEPTH) {
            throw FiltersParseError.syntaxInvalid('The maximum nesting depth was exceeded.');
        }

        const keys = Object.keys(input);
        if (keys.some((key) => MONGO_FIELD_OPERATORS.includes(key))) {
            // grammar of the interior is validated like any other
            // operator object (unknown operators, plain keys and
            // misplaced compounds throw).
            const regex = this.validateOperatorObject(resolved.field, input, false);

            const conditions = this.buildOperatorObject(
                input,
                {
                    field: ITSELF,
                    name: ITSELF,
                    scope: this.buildUnboundScope(resolved.scope),
                },
                false,
                depth + 1,
                regex,
            );

            const condition = this.combineDocument(conditions, false);

            /* istanbul ignore next -- validation rejected empty interiors */
            if (!condition) {
                return undefined;
            }

            return new Filter(FilterFieldOperator.ELEM_MATCH, resolved.field, condition);
        }

        let child : FiltersScope | undefined;
        if (resolved.name === ITSELF) {
            // the element itself is never schema-resolvable.
            child = this.buildUnboundScope(resolved.scope);
        } else {
            try {
                const verdict = resolved.scope.descend(resolved.name);
                if (verdict instanceof ResolutionScope) {
                    child = verdict;
                } else if (verdict.code !== KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE) {
                    // relations gating (pathNotPermitted) is a schema-policy
                    // failure for the entry — drop it.
                    return undefined;
                }
            } catch (e) {
                // $elemMatch on a non-relation field is legal — a missing
                // related schema (thrown as keyPathInvalid under
                // throwOnFailure) falls back to the unbound scope;
                // every other failure propagates.
                if (
                    !(e instanceof ParseError) ||
                    e.code !== ErrorCode.KEY_PATH_INVALID
                ) {
                    throw e;
                }
            }
        }

        if (!child) {
            child = this.buildUnboundScope(resolved.scope);
        }

        const conditions = this.parseDocument(input, child, false, depth + 1);

        // an interior with no conditions drops the whole entry.
        const condition = this.combineDocument(conditions, false);
        if (!condition) {
            return undefined;
        }

        return new Filter(FilterFieldOperator.ELEM_MATCH, resolved.field, condition);
    }

    protected buildUnboundScope(current: FiltersScope) : FiltersScope {
        return ResolutionScope.for(this.registry, Parameter.FILTERS, undefined, {
            throwOnFailure: current.throwOnFailure,
            strict: current.strict,
        }) as FiltersScope;
    }
}

// ---------------------------------------------------------

function isPlainObject(input: unknown) : input is Record<string, any> {
    if (!isObject(input)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(input);

    return prototype === null || prototype === Object.prototype;
}

function isComparableValue(input: unknown) : boolean {
    return input === null ||
        typeof input === 'string' ||
        typeof input === 'number' ||
        typeof input === 'boolean' ||
        input instanceof Date;
}

function isOrderableValue(input: unknown) : boolean {
    return typeof input === 'string' ||
        typeof input === 'number' ||
        input instanceof Date;
}

function isMongoCompoundOperator(input: string) : input is MongoCompoundOperator {
    return (MONGO_COMPOUND_OPERATORS as readonly string[]).includes(input);
}

function isMongoComparisonOperator(input: string) : input is MongoComparisonOperator {
    return Object.prototype.hasOwnProperty.call(MONGO_COMPARISON_OPERATORS, input);
}
