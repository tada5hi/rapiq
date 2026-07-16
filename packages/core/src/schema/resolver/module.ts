/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MAX_TRAVERSAL_DEPTH, Parameter } from '../../constants';
import type { ParseError } from '../../errors';
import type { IRelations } from '../../parameter';
import { FieldsParseError } from '../../parser/parameter/fields/error';
import { FiltersParseError } from '../../parser/parameter/filters/error';
import { PaginationParseError } from '../../parser/parameter/pagination/error';
import { RelationsParseError } from '../../parser/parameter/relations/error';
import { SortParseError } from '../../parser/parameter/sort/error';
import type { ObjectLiteral } from '../../types';
import { applyMapping, isPathAllowed, isPropertyNameValid } from '../../utils';
import { Schema } from '../module';
import {
    FieldsSchema,
    FiltersSchema,
    PaginationSchema,
    RelationsSchema,
    SortSchema,
} from '../parameter';
import type { SchemaRegistry } from '../registry';
import { KeyResolutionErrorCode } from './constants';
import type {
    KeyResolution,
    KeyResolutionFailure,
    ParameterSchema,
    ResolutionScopeContext,
} from './types';

const PARAMETER_SCHEMA_CLASSES = {
    [Parameter.FIELDS]: FieldsSchema,
    [Parameter.FILTERS]: FiltersSchema,
    [Parameter.PAGINATION]: PaginationSchema,
    [Parameter.RELATIONS]: RelationsSchema,
    [Parameter.SORT]: SortSchema,
} as const;

const PARAMETER_ERROR_CLASSES : Record<`${Parameter}`, typeof ParseError> = {
    [Parameter.FIELDS]: FieldsParseError,
    [Parameter.FILTERS]: FiltersParseError,
    [Parameter.PAGINATION]: PaginationParseError,
    [Parameter.RELATIONS]: RelationsParseError,
    [Parameter.SORT]: SortParseError,
};

/**
 * Relation names may contain digits and dashes (unlike attribute names).
 */
const RELATION_NAME_REGEX = /^[a-zA-Z0-9_-]+([.]*[a-zA-Z0-9_-])*$/u;

/**
 * Upper bound for relation traversal. Mapping aliases may expand at every
 * level, so a cyclic mapping/schemaMapping configuration could otherwise
 * recurse without ever consuming input.
 */
const MAX_DEPTH = MAX_TRAVERSAL_DEPTH;

type ResolutionScopeOptions<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    registry: SchemaRegistry,
    parameter: P,
    schema: ParameterSchema<P, RECORD>,
    bound: boolean,
    base?: Schema<RECORD>,
    relations?: IRelations,
    segment?: string,
    depth?: number,
    throwOnFailure?: boolean,
    strict?: boolean,
    errors: typeof ParseError,
};

/**
 * An immutable handle on one parameter of one schema, under one failure policy.
 *
 * Owns the shared resolution pipeline every parser previously duplicated:
 * schema-input normalization, alias mapping, allow-list verdicts,
 * relation-path traversal through the registry (schemaMapping-aware)
 * and the throw-vs-drop failure policy including error-class selection.
 */
export class ResolutionScope<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
> {
    readonly parameter: P;

    /**
     * The resolved parameter sub-schema — escape hatch for parameter quirks.
     */
    readonly schema: ParameterSchema<P, RECORD>;

    /**
     * Parsed relations governing which relation segments may be entered.
     */
    readonly relations: IRelations | undefined;

    /**
     * Canonical (alias-resolved) relation segment this scope was entered through,
     * undefined for root scopes.
     */
    readonly segment: string | undefined;

    protected registry: SchemaRegistry;

    protected base: Schema<RECORD> | undefined;

    protected bound: boolean;

    protected depth: number;

    protected throwOnFailureContext: boolean | undefined;

    protected strictContext: boolean | undefined;

    protected errors: typeof ParseError;

    // ---------------------------------------------------------

    protected constructor(options: ResolutionScopeOptions<P, RECORD>) {
        this.registry = options.registry;
        this.parameter = options.parameter;
        this.schema = options.schema;
        this.bound = options.bound;
        this.base = options.base;
        this.relations = options.relations;
        this.segment = options.segment;
        this.depth = options.depth ?? 0;
        this.throwOnFailureContext = options.throwOnFailure;
        this.strictContext = options.strict;
        this.errors = options.errors;
    }

    // ---------------------------------------------------------

    /**
     * Effective failure policy: context override ?? schema setting ?? false.
     */
    get throwOnFailure() : boolean {
        return this.throwOnFailureContext ?? this.schema.throwOnFailure ?? false;
    }

    /**
     * Effective strict policy: context override ?? schema setting ?? false.
     * Under strict mode a parameter without an explicit allow-list rejects
     * every client key instead of falling back to the syntactic name check.
     */
    get strict() : boolean {
        return this.strictContext ?? this.schema.strict ?? false;
    }

    // ---------------------------------------------------------

    /**
     * Entry point. Normalizes every schema input shape
     * (registry name | Schema | parameter sub-schema | undefined → empty schema)
     * and binds the parse context.
     */
    static for<
        P extends `${Parameter}`,
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        registry: SchemaRegistry,
        parameter: P,
        schema?: string | Schema<RECORD> | ParameterSchema<P, RECORD>,
        context: ResolutionScopeContext = {},
    ) : ResolutionScope<P, RECORD> {
        let base : Schema<RECORD> | undefined;
        let parameterSchema : ParameterSchema<P, RECORD>;

        if (typeof schema === 'string' || schema instanceof Schema) {
            base = registry.getOrFail(schema);
            parameterSchema = base[parameter as Parameter] as ParameterSchema<P, RECORD>;
        } else if (schema instanceof PARAMETER_SCHEMA_CLASSES[parameter as Parameter]) {
            parameterSchema = schema as ParameterSchema<P, RECORD>;
        } else {
            parameterSchema = buildEmptyParameterSchema<P, RECORD>(parameter);
        }

        return new ResolutionScope<P, RECORD>({
            registry,
            parameter,
            schema: parameterSchema,
            bound: typeof schema !== 'undefined',
            base,
            relations: context.relations,
            throwOnFailure: context.throwOnFailure,
            strict: context.strict,
            errors: context.errors ?? PARAMETER_ERROR_CLASSES[parameter as `${Parameter}`],
        });
    }

    // ---------------------------------------------------------

    /**
     * Resolve a raw client key (local "title", aliased "abc" or dotted "items.title").
     * Applies mapping aliases, checks the allow-list (or the property-name pattern when
     * no allow-list is set) and for dotted keys walks the relation path through the
     * registry honoring schemaMapping — validating the leaf against the target schema.
     *
     * Throws the parameter's ParseError subclass instead of returning `{ success: false }`
     * when the effective failure policy is set.
     */
    resolveKey(key: string) : KeyResolution<P, RECORD> {
        const mapped = applyMapping(key, this.mapping);

        const separatorIndex = mapped.indexOf('.');
        if (separatorIndex === -1) {
            const code = this.checkName(mapped);
            if (code) {
                return this.fail(code, key, mapped);
            }

            return {
                success: true,
                name: mapped,
                path: [],
                scope: this,
            };
        }

        const segment = mapped.substring(0, separatorIndex);
        const rest = mapped.substring(separatorIndex + 1);

        const child = this.descendSegment(segment, key);
        if (!(child instanceof ResolutionScope)) {
            return child;
        }

        const resolved = child.resolveKey(rest);
        if (!resolved.success) {
            return { ...resolved, input: key };
        }

        return {
            success: true,
            name: resolved.name,
            path: [segment, ...resolved.path],
            scope: resolved.scope,
        };
    }

    /**
     * Enter a relation: checks the (alias-resolved) segment against the permitted
     * relations, resolves the child schema via the registry (schemaMapping-aware,
     * starting from the schema instance when available), extracts the child
     * relations sub-tree and returns a child scope inheriting the failure policy.
     *
     * A mapping alias may expand to a dotted path — every segment is walked,
     * and the returned scope reports the full relative path as its segment.
     */
    descend(key: string) : ResolutionScope<P, RECORD> | KeyResolutionFailure {
        const mapped = applyMapping(key, this.mapping);

        const separatorIndex = mapped.indexOf('.');
        if (separatorIndex === -1) {
            return this.descendSegment(mapped, key);
        }

        const segments = mapped.split('.');

        let scope = this.descendSegment(segments[0] as string, key);
        for (const segment of segments.slice(1)) {
            if (!(scope instanceof ResolutionScope)) {
                return scope;
            }

            scope = scope.descendSegment(segment, key);
        }

        if (!(scope instanceof ResolutionScope)) {
            return scope;
        }

        return scope.withSegment(mapped);
    }

    // ---------------------------------------------------------

    protected descendSegment(
        segment: string,
        input: string,
    ) : ResolutionScope<P, RECORD> | KeyResolutionFailure {
        if (this.depth >= MAX_DEPTH) {
            return this.fail(KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE, input, segment);
        }

        const code = this.checkSegment(segment);
        if (code) {
            return this.fail(code, input, segment);
        }

        const base = this.resolveBase();

        let childBase : Schema<RECORD> | undefined;
        if (base) {
            childBase = this.registry.get(base.mapSchema(segment));
        } else {
            childBase = this.registry.get(segment);
        }

        if (
            !childBase &&
            this.parameter !== Parameter.RELATIONS &&
            !this.isUnbound()
        ) {
            // relations semantics differ: child schemas are optional refinements.
            // Unbound scopes (no schema identity) impose no traversal constraints,
            // so both descend into an unbound child scope instead of failing.
            return this.fail(KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE, input, segment);
        }

        let schema : ParameterSchema<P, RECORD>;
        if (childBase) {
            schema = childBase[this.parameter as Parameter] as ParameterSchema<P, RECORD>;
        } else {
            schema = buildEmptyParameterSchema<P, RECORD>(this.parameter);
        }

        let relations : IRelations | undefined;
        if (this.relations) {
            relations = this.relations.extract(segment);
        }

        return new ResolutionScope<P, RECORD>({
            registry: this.registry,
            parameter: this.parameter,
            schema,
            bound: !!childBase,
            base: childBase,
            relations,
            segment,
            depth: this.depth + 1,
            throwOnFailure: this.throwOnFailureContext,
            strict: this.strictContext,
            errors: this.errors,
        });
    }

    /**
     * Allow-list verdict for a local (alias-resolved) name.
     */
    protected checkName(name: string) : KeyResolutionErrorCode | undefined {
        switch (this.parameter as `${Parameter}`) {
            case Parameter.FIELDS: {
                const schema = this.schema as FieldsSchema<RECORD>;
                if (schema.allowedIsUndefined && schema.defaultIsUndefined) {
                    if (this.strict) {
                        return KeyResolutionErrorCode.KEY_NOT_PERMITTED;
                    }

                    return isPropertyNameValid(name) ?
                        undefined :
                        KeyResolutionErrorCode.KEY_INVALID;
                }

                return schema.isValid(name) ?
                    undefined :
                    KeyResolutionErrorCode.KEY_NOT_PERMITTED;
            }
            case Parameter.FILTERS: {
                const schema = this.schema as FiltersSchema<RECORD>;
                if (schema.allowedIsUndefined) {
                    if (this.strict) {
                        return KeyResolutionErrorCode.KEY_NOT_PERMITTED;
                    }

                    return isPropertyNameValid(name) ?
                        undefined :
                        KeyResolutionErrorCode.KEY_INVALID;
                }

                return schema.allowed.includes(name) ?
                    undefined :
                    KeyResolutionErrorCode.KEY_NOT_PERMITTED;
            }
            case Parameter.SORT: {
                const schema = this.schema as SortSchema<RECORD>;
                if (schema.allowedIsUndefined) {
                    if (this.strict) {
                        return KeyResolutionErrorCode.KEY_NOT_PERMITTED;
                    }

                    return isPropertyNameValid(name) ?
                        undefined :
                        KeyResolutionErrorCode.KEY_INVALID;
                }

                // tuple groups (string[][]) are matched all-or-nothing by the
                // sort parser afterwards — individual names pass through here.
                if (isMultiDimensionalArray(schema.allowed)) {
                    return undefined;
                }

                return schema.allowed.includes(name) ?
                    undefined :
                    KeyResolutionErrorCode.KEY_NOT_PERMITTED;
            }
            case Parameter.RELATIONS: {
                const schema = this.schema as RelationsSchema<RECORD>;
                if (typeof schema.allowed === 'undefined') {
                    if (this.strict) {
                        return KeyResolutionErrorCode.KEY_NOT_PERMITTED;
                    }

                    return RELATION_NAME_REGEX.test(name) ?
                        undefined :
                        KeyResolutionErrorCode.KEY_INVALID;
                }

                return isPathAllowed(name, schema.allowed) ?
                    undefined :
                    KeyResolutionErrorCode.KEY_NOT_PERMITTED;
            }
            default:
                return undefined;
        }
    }

    /**
     * Permission verdict for entering a relation segment.
     */
    protected checkSegment(segment: string) : KeyResolutionErrorCode | undefined {
        if (this.parameter === Parameter.RELATIONS) {
            const schema = this.schema as RelationsSchema<RECORD>;
            if (typeof schema.allowed === 'undefined') {
                return this.strict ?
                    KeyResolutionErrorCode.PATH_NOT_PERMITTED :
                    undefined;
            }

            if (!isPathAllowed(segment, schema.allowed)) {
                return KeyResolutionErrorCode.PATH_NOT_PERMITTED;
            }

            return undefined;
        }

        return isPathAllowed(segment, this.relations) ?
            undefined :
            KeyResolutionErrorCode.PATH_NOT_PERMITTED;
    }

    protected resolveBase() : Schema<RECORD> | undefined {
        if (this.base) {
            return this.base;
        }

        if (this.schema.name) {
            return this.registry.get(this.schema.name);
        }

        return undefined;
    }

    /**
     * A scope created without any schema input describes no record
     * and imposes no traversal constraints.
     */
    protected isUnbound() : boolean {
        return !this.bound;
    }

    protected withSegment(segment: string) : ResolutionScope<P, RECORD> {
        return new ResolutionScope<P, RECORD>({
            registry: this.registry,
            parameter: this.parameter,
            schema: this.schema,
            bound: this.bound,
            base: this.base,
            relations: this.relations,
            segment,
            depth: this.depth,
            throwOnFailure: this.throwOnFailureContext,
            strict: this.strictContext,
            errors: this.errors,
        });
    }

    protected fail(
        code: KeyResolutionErrorCode,
        input: string,
        segment?: string,
    ) : KeyResolutionFailure {
        if (this.throwOnFailure) {
            switch (code) {
                case KeyResolutionErrorCode.KEY_INVALID:
                    throw this.errors.keyInvalid(segment ?? input);
                case KeyResolutionErrorCode.KEY_NOT_PERMITTED:
                    throw this.errors.keyNotPermitted(segment ?? input);
                case KeyResolutionErrorCode.PATH_NOT_PERMITTED:
                    throw this.errors.keyPathNotPermitted(segment ?? input);
                default:
                    throw this.errors.keyPathInvalid(segment ?? input);
            }
        }

        const output : KeyResolutionFailure = {
            success: false,
            code,
            input,
        };
        if (typeof segment !== 'undefined') {
            output.segment = segment;
        }

        return output;
    }

    protected get mapping() : Record<string, string> | undefined {
        const schema = this.schema as { mapping?: Record<string, string> };

        return schema.mapping;
    }
}

function buildEmptyParameterSchema<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
>(parameter: P) : ParameterSchema<P, RECORD> {
    const SchemaClass = PARAMETER_SCHEMA_CLASSES[parameter as Parameter] as
        new (options: ObjectLiteral) => ParameterSchema<P, RECORD>;

    return new SchemaClass({});
}

function isMultiDimensionalArray(input: string[] | string[][]) : input is string[][] {
    return input.length > 0 && Array.isArray(input[0]);
}
