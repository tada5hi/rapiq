/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MAX_TRAVERSAL_DEPTH, Parameter } from '../../constants';
import {
    ErrorCode,
    ErrorMessage,
    buildIssue,
} from '../../errors';
import type { IssueInput, ParseError } from '../../errors';
import type { IRelations } from '../../parameter';
import type { IIssueCollector } from '../../parser/issue';
import { PARAMETER_ERROR_CLASSES } from '../../parser/issue/constants';
import type { PendingKeyValidation } from '../../parser/parameter/types';
import type { ObjectLiteral } from '../../types';
import {
    applyMapping,
    isPathAllowed,
    isPropertyNameValid,
    toIssuePath,
} from '../../utils';
import { Schema } from '../module';
import {
    AggregatesSchema,
    FieldsSchema,
    FiltersSchema,
    GroupsSchema,
    PaginationSchema,
    RelationsSchema,
    SortsSchema,
} from '../parameter';
import type { SchemaRegistry } from '../registry';
import { KeyResolutionErrorCode } from './constants';
import type {
    ElementScopeMode,
    KeyResolution,
    KeyResolutionFailure,
    ParameterSchema,
    ResolutionScopeContext,
} from './types';
import type { Issue } from '@ebec/core';

const PARAMETER_SCHEMA_CLASSES = {
    [Parameter.FIELDS]: FieldsSchema,
    [Parameter.FILTERS]: FiltersSchema,
    [Parameter.PAGINATION]: PaginationSchema,
    [Parameter.RELATIONS]: RelationsSchema,
    [Parameter.SORTS]: SortsSchema,
    [Parameter.SORT]: SortsSchema,
    [Parameter.GROUPS]: GroupsSchema,
    [Parameter.AGGREGATES]: AggregatesSchema,
} as const;

/**
 * How a key-resolution verdict reads on both failure channels: the
 * {@link ErrorCode} and message text a thrown error carries, and the issue a
 * collecting parse records instead.
 */
const KEY_RESOLUTION_FAILURES : Record<KeyResolutionErrorCode, {
    code: `${ErrorCode}`,
    message: (name: string) => string,
}> = {
    [KeyResolutionErrorCode.KEY_INVALID]: {
        code: ErrorCode.KEY_INVALID,
        message: ErrorMessage.keyInvalid,
    },
    [KeyResolutionErrorCode.KEY_NOT_PERMITTED]: {
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted,
    },
    [KeyResolutionErrorCode.PATH_NOT_PERMITTED]: {
        code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        message: ErrorMessage.keyPathNotPermitted,
    },
    [KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE]: {
        code: ErrorCode.KEY_PATH_INVALID,
        message: ErrorMessage.keyPathInvalid,
    },
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
    rootBase?: Schema<RECORD>,
    rootSchema?: ParameterSchema<P, RECORD>,
    relations?: IRelations,
    segment?: string,
    path?: string[],
    obligationSink?: PendingKeyValidation[],
    issueCollector?: IIssueCollector,
    depth?: number,
    throwOnFailure?: boolean,
    resolutionThrowOnFailure?: boolean,
    strict?: boolean,
    element?: ElementScopeMode,
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
     * The parameter sub-schema this scope chain STARTED from. A descended
     * scope with no registered child schema falls back to an empty one, so
     * the original is kept: for a bare (base-less) relations sub-schema it
     * is the only authorization authority there is, and it has to govern
     * every hop rather than the first one alone.
     */
    protected rootSchema: ParameterSchema<P, RECORD>;

    /**
     * Parsed relations governing which relation segments may be entered.
     */
    readonly relations: IRelations | undefined;

    /**
     * Canonical (alias-resolved) relation segment this scope was entered through,
     * undefined for root scopes.
     */
    readonly segment: string | undefined;

    /**
     * Canonical (alias-resolved) relation path from the parameter root to this
     * scope (root: `[]`). Drives absolute obligation/prune paths across the
     * grouping recursion — see {@link relationObligations}.
     */
    readonly path: string[];

    protected registry: SchemaRegistry;

    protected base: Schema<RECORD> | undefined;

    /**
     * The parameter root record schema, propagated unchanged through descents.
     * The anchor {@link relationObligations} walks to reach the relations
     * sub-schema governing each traversed segment.
     */
    protected rootBase: Schema<RECORD> | undefined;

    /**
     * Relation-authorization ledger this scope records into on every successful
     * {@link resolveKey}; propagated to descendants. Undefined for scopes whose
     * caller does not authorize relations.
     */
    protected obligationSink: PendingKeyValidation[] | undefined;

    /**
     * Trace of the parse this scope resolves for; propagated to descendants.
     * Present: {@link fail} records its verdict and lets the parse continue on
     * the drop path, and the owning parse call raises the whole trace at the
     * end. Absent (a scope built outside a parse): failures throw where they
     * are found, as they always did.
     */
    readonly issueCollector: IIssueCollector | undefined;

    protected bound: boolean;

    protected depth: number;

    protected throwOnFailureContext: boolean | undefined;

    /**
     * Key-resolution policy a dialect forces on this scope, overriding
     * {@link throwOnFailureContext} for allow-list and traversal verdicts
     * alone.
     */
    protected resolutionThrowOnFailureContext: boolean | undefined;

    protected strictContext: boolean | undefined;

    /**
     * Set when this scope addresses the elements of an array operator's
     * target that is no registered relation (#1005). An element scope
     * describes no record and never consults the registry: under `array`
     * (a JSON array column) a dotted key is an opaque element sub-path,
     * checked for identifier validity alone; under `relation` (a declared
     * relation whose schema is not registered) only single-segment keys
     * resolve, since a dotted one would join on from the related row.
     */
    protected element: ElementScopeMode | undefined;

    // ---------------------------------------------------------

    protected constructor(options: ResolutionScopeOptions<P, RECORD>) {
        this.registry = options.registry;
        this.parameter = options.parameter;
        this.schema = options.schema;
        this.rootSchema = options.rootSchema ?? options.schema;
        this.bound = options.bound;
        this.base = options.base;
        this.rootBase = options.rootBase;
        this.relations = options.relations;
        this.segment = options.segment;
        this.path = options.path ?? [];
        this.obligationSink = options.obligationSink;
        this.issueCollector = options.issueCollector;
        this.depth = options.depth ?? 0;
        this.throwOnFailureContext = options.throwOnFailure;
        this.resolutionThrowOnFailureContext = options.resolutionThrowOnFailure;
        this.strictContext = options.strict;
        this.element = options.element;
    }

    // ---------------------------------------------------------

    /**
     * Effective failure policy for key resolution: the dialect's forced one
     * ({@link ResolutionScopeContext.resolutionThrowOnFailure}) ?? context
     * override ?? schema setting ?? false.
     */
    get throwOnFailure() : boolean {
        return this.resolutionThrowOnFailureContext ??
            this.throwOnFailureContext ??
            this.schema.throwOnFailure ??
            false;
    }

    /**
     * Failure policy governing relation authorization for this scope's record:
     * the call-time override, backed by the relations sub-schema's own
     * `throwOnFailure` (schema-level intent), the same
     * `throwOnFailure ?? schema.relations.throwOnFailure ?? false` the query
     * pass applies, so standalone and query parses agree.
     *
     * Deliberately blind to {@link throwOnFailure}'s forced half: a dialect
     * that cannot resolve keys partially (expression) must still *drop* an
     * unauthorized relation unless the caller or the relations schema opts
     * into throwing.
     */
    get relationsThrowOnFailure() : boolean {
        if (typeof this.throwOnFailureContext !== 'undefined') {
            return this.throwOnFailureContext;
        }

        if (this.rootBase) {
            return this.rootBase.relations.throwOnFailure ?? false;
        }

        // mirrors relationObligationForTerminal: a bare relations
        // sub-schema carries its own failure policy.
        if (this.parameter === Parameter.RELATIONS) {
            return (this.rootSchema as RelationsSchema<RECORD>).throwOnFailure ?? false;
        }

        return false;
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
            parameterSchema = base[parameter] as ParameterSchema<P, RECORD>;
        } else if (schema instanceof PARAMETER_SCHEMA_CLASSES[parameter as Parameter]) {
            parameterSchema = schema as ParameterSchema<P, RECORD>;
        } else {
            parameterSchema = buildEmptyParameterSchema<P, RECORD>(parameter);
        }

        // the record anchor for relation-authorization obligations: the bound
        // schema, or the one the parameter sub-schema names (registered).
        let rootBase = base;

        if (!rootBase && parameterSchema.name) {
            rootBase = registry.get(parameterSchema.name);
        }

        return new ResolutionScope<P, RECORD>({
            registry,
            parameter,
            schema: parameterSchema,
            bound: typeof schema !== 'undefined',
            base,
            rootBase,
            relations: context.relations,
            throwOnFailure: context.throwOnFailure,
            resolutionThrowOnFailure: context.resolutionThrowOnFailure,
            strict: context.strict,
            obligationSink: context.obligationSink,
            issueCollector: context.issueCollector,
        });
    }

    /**
     * An element scope (see {@link descendElement}) under the failure
     * policy of `current`: the interior of an array operator addressing
     * the element itself (`ITSELF`, arrays of arrays), which is never a
     * relation. `segment` names the array the element scope was entered
     * through, extending the issue path of a failure inside it. `mode`
     * defaults to the mode of `current` when it is an element scope itself
     * (a nested interior never widens), otherwise to `array`.
     */
    static forElement<
        P extends `${Parameter}`,
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        current: ResolutionScope<P, RECORD>,
        segment?: string,
        mode?: ElementScopeMode,
    ) : ResolutionScope<P, RECORD> {
        return new ResolutionScope<P, RECORD>({
            registry: current.registry,
            parameter: current.parameter,
            schema: buildEmptyParameterSchema<P, RECORD>(current.parameter),
            bound: false,
            element: current.element ?? mode ?? 'array',
            segment,
            path: typeof segment === 'undefined' ?
                current.path :
                [...current.path, segment],
            issueCollector: current.issueCollector,
            depth: current.depth + 1,
            // the effective policies, so a schema-level setting of
            // `current` survives the empty element schema.
            throwOnFailure: current.throwOnFailureContext ?? current.schema.throwOnFailure,
            resolutionThrowOnFailure: current.resolutionThrowOnFailureContext,
            strict: current.strict,
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
     *
     * `relationTarget` marks the key as an array operator's target
     * (`size`, `elemMatch`, `all`): a leaf that is a relation is then gated
     * by {@link checkRelationTarget}, and any other leaf by
     * {@link checkArrayTarget}, before any authorization obligation is
     * recorded, so a rejected relation never reaches the relations hook.
     */
    resolveKey(
        key: string,
        raw: string = key,
        options: { relationTarget?: boolean } = {},
    ) : KeyResolution<P, RECORD> {
        if (this.element) {
            return this.resolveElementKey(key, raw);
        }

        const mapped = applyMapping(key, this.mapping);

        const separatorIndex = mapped.indexOf('.');

        if (separatorIndex === -1) {
            const code = this.checkName(mapped);

            if (code) {
                return this.fail(code, key, mapped, raw);
            }

            if (options.relationTarget) {
                const failure = this.checkRelationTarget(mapped, key) ??
                    this.checkArrayTarget(mapped, key);

                if (failure) {
                    return failure;
                }
            }

            // resolution reached the leaf: record the authorization obligations
            // for the relations it traversed (this scope's absolute path) plus a
            // leaf that is itself a relation (an array operator's target). This
            // is the single choke point — every dialect resolves through here, so
            // no join source can silently escape the relations gate.
            this.recordObligations(mapped);

            return {
                success: true,
                name: mapped,
                path: [],
                scope: this,
            };
        }

        const segment = mapped.substring(0, separatorIndex);
        const rest = mapped.substring(separatorIndex + 1);

        const child = this.descendSegment(segment, key, raw);

        if (!(child instanceof ResolutionScope)) {
            return child;
        }

        const resolved = child.resolveKey(rest, raw, options);

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
     * Report a violation this scope's parameter found on its own (an input of
     * the wrong shape, an unparseable value, a limit above the maximum)
     * rather than one key resolution decided.
     *
     * Same policy as {@link resolveKey}: nothing at all while the policy
     * drops, and under a throwing one recorded into the parse's trace when
     * there is one (the owning call raises it once every parameter has been
     * seen), thrown here when there is not. The caller always continues on its
     * drop path; whether that path's result is ever observed is the trace's
     * decision, not the caller's.
     */
    refuse(input: {
        code: `${ErrorCode}`,
        message: string,
        /**
         * Canonical position, defaulting to this scope's relation path.
         */
        path?: string[],
        key?: string,
        input?: unknown,
        /**
         * Policy override, for a site governed by another sub-schema's
         * failure policy than its own scope's.
         */
        throwOnFailure?: boolean,
    }) : void {
        const throwOnFailure = input.throwOnFailure ?? this.throwOnFailure;

        if (!throwOnFailure) {
            return;
        }

        const issue : IssueInput = {
            code: input.code,
            parameter: this.parameter,
            path: input.path ?? [...this.path],
            message: input.message,
        };

        if (typeof input.key !== 'undefined') {
            issue.key = input.key;
        }

        if (Object.hasOwn(input, 'input')) {
            issue.received = input.input;
        }

        if (this.issueCollector) {
            this.issueCollector.add(issue);

            return;
        }

        const ErrorClass = PARAMETER_ERROR_CLASSES[
            this.parameter as `${Parameter}`
        ];

        throw new ErrorClass({
            code: input.code,
            message: input.message,
            issues: [
                buildIssue(issue),
            ],
        });
    }

    /**
     * Enter a relation: checks the (alias-resolved) segment against the permitted
     * relations, resolves the child schema via the registry (schemaMapping-aware,
     * starting from the schema instance when available), extracts the child
     * relations sub-tree and returns a child scope inheriting the failure policy.
     *
     * A mapping alias may expand to a dotted path — every segment is walked,
     * and the returned scope reports the full relative path as its segment.
     *
     * `optional` marks a descent whose target may legitimately not be a
     * relation at all: an array operator's interior (`elemMatch`) addresses
     * the elements of whatever it names, so "no schema for this key" is an
     * answer, not a violation, and is returned as a bare verdict without
     * being thrown or recorded. Every other failure stays a failure.
     *
     * `gated: false` skips the schema relation policy
     * ({@link checkRelationPolicy}) for an internal lookup over a tree the
     * server already accepted, e.g. reading the indexes or sort defaults
     * of the schema governing a resolved path: a server-authored residual
     * may legitimately traverse a relation no client may name (#1001).
     */
    descend(
        key: string,
        options: { optional?: boolean, gated?: boolean } = {},
    ) : ResolutionScope<P, RECORD> | KeyResolutionFailure {
        if (this.element) {
            return ResolutionScope.forElement(this, key);
        }

        const mapped = applyMapping(key, this.mapping);
        const gated = options.gated ?? true;

        const separatorIndex = mapped.indexOf('.');

        if (separatorIndex === -1) {
            return this.descendSegment(mapped, key, key, options.optional, gated);
        }

        const segments = mapped.split('.');

        let scope = this.descendSegment(segments[0] as string, key, key, options.optional, gated);

        for (const segment of segments.slice(1)) {
            if (!(scope instanceof ResolutionScope)) {
                return scope;
            }

            scope = scope.descendSegment(segment, key, key, options.optional, gated);
        }

        if (!(scope instanceof ResolutionScope)) {
            return scope;
        }

        return scope.withSegment(mapped);
    }

    /**
     * The scope governing the interior of an array operator (`size`,
     * `elemMatch`, `all`) on the (alias-resolved) leaf `name` of this scope.
     *
     * A relation whose target schema is registered binds the interior to
     * that schema, gated per hop exactly like a dotted path ({@link descend}).
     * Every other target yields an element scope, so an interior key can
     * never reach a relation around the schema policy (#1005): an `array`
     * one for a JSON array column (listed in the filters `arrays` option or
     * undeclared), a `relation` one, admitting no dotted key, for a declared
     * relation whose schema is not registered. The interior of an element
     * scope keeps its mode. A relation refused by the policy comes back as
     * the failure, recorded or thrown under this scope's failure policy.
     */
    descendElement(name: string) : ResolutionScope<P, RECORD> | KeyResolutionFailure {
        if (this.element || this.isArrayColumn(name)) {
            return ResolutionScope.forElement(this, name);
        }

        const verdict = this.descend(name, { optional: true });

        if (verdict instanceof ResolutionScope) {
            // an unbound root descends by registry name and may land on a
            // registered schema; a name nothing describes stays an element.
            return verdict.bound ?
                verdict :
                ResolutionScope.forElement(this, name);
        }

        // no schema for this target: an answer, not a violation.
        if (verdict.code === KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE) {
            return ResolutionScope.forElement(
                this,
                name,
                this.isDeclaredRelation(name) ? 'relation' : 'array',
            );
        }

        return verdict;
    }

    /**
     * Gate a resolved leaf `name` that an array operator (`size`,
     * `elemMatch`, `all`) targets and that is not a relation of this
     * scope's record (a relation is governed by {@link checkRelationTarget}).
     * Such a target must be a JSON array column: one listed in the filters
     * `arrays` option, or, while that option is undeclared, any column
     * unless the scope is strict. Refused with `keyNotPermitted`.
     *
     * Returns `undefined` when permitted, always for an unbound or element
     * scope and for parameters other than filters, otherwise the failure,
     * recorded or thrown under this scope's failure policy.
     */
    checkArrayTarget(name: string, input: string = name) : KeyResolutionFailure | undefined {
        if (
            this.element ||
            this.isUnbound() ||
            this.parameter !== Parameter.FILTERS ||
            this.isRelationLeaf(name)
        ) {
            return undefined;
        }

        const { arrays } = this.schema as FiltersSchema<RECORD>;

        if (typeof arrays === 'undefined') {
            if (!this.strict) {
                return undefined;
            }
        } else if (arrays.includes(name)) {
            return undefined;
        }

        return this.fail(KeyResolutionErrorCode.KEY_NOT_PERMITTED, input, name);
    }

    /**
     * Resolve a key inside an element scope; nothing is recorded as a
     * relation obligation. Under `array` the whole (dotted) key is one
     * opaque element sub-path and only identifier validity is checked.
     * Under `relation` a single-segment key passes the same name check an
     * unbound scope applies, and a dotted key is refused with
     * `schemaUnresolvable`, the verdict the same path gets at the top
     * level: the related schema is not registered, so no hop from it can
     * be gated.
     */
    protected resolveElementKey(key: string, raw: string) : KeyResolution<P, RECORD> {
        if (this.element === 'relation') {
            const separatorIndex = key.indexOf('.');

            if (separatorIndex !== -1) {
                return this.fail(
                    KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                    key,
                    key.substring(0, separatorIndex),
                    raw,
                );
            }

            const code = this.checkName(key);

            if (code) {
                return this.fail(code, key, key, raw);
            }

            return {
                success: true,
                name: key,
                path: [],
                scope: this,
            };
        }

        const segments = toIssuePath(key);
        const invalid = segments.some((segment) => !isPropertyNameValid(segment));

        if (segments.length === 0 || invalid) {
            return this.fail(KeyResolutionErrorCode.KEY_INVALID, key, undefined, raw);
        }

        return {
            success: true,
            name: key,
            path: [],
            scope: this,
        };
    }

    /**
     * Whether `name` is listed in this filters scope's `arrays` option: a
     * JSON array column, never a relation, even when a registered schema
     * shares its name.
     */
    protected isArrayColumn(name: string) : boolean {
        if (this.parameter !== Parameter.FILTERS) {
            return false;
        }

        const { arrays } = this.schema as FiltersSchema<RECORD>;

        return !!arrays && arrays.includes(name);
    }

    // ---------------------------------------------------------

    protected descendSegment(
        segment: string,
        input: string,
        raw: string = input,
        optional?: boolean,
        gated: boolean = true,
    ) : ResolutionScope<P, RECORD> | KeyResolutionFailure {
        if (this.depth >= MAX_DEPTH) {
            return this.fail(KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE, input, segment, raw);
        }

        const code = this.checkSegment(segment);

        if (code) {
            return this.fail(code, input, segment, raw);
        }

        const base = this.resolveBase();

        let childBase : Schema<RECORD> | undefined;

        if (this.isArrayColumn(segment)) {
            // a declared array column is never a relation.
            childBase = undefined;
        } else if (base) {
            childBase = this.registry.get(base.mapSchema(segment));
        } else {
            // Intentional: a standalone filters/sorts schema with no base
            // schema has no record identity, so there is no relations list
            // to gate against. It descends by registry name, and the hop is
            // permitted unless the scope is strict or the schema's own
            // `relations` option excludes it (checkRelationPolicy).
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
            if (optional) {
                // a relation the base schema declares (e.g. via
                // schemaMapping) is still a relation when its target is not
                // registered: an array operator's interior must not
                // reach it outside the permitted list (#1001).
                if (gated && this.isDeclaredRelation(segment)) {
                    const declaredCode = this.checkRelationPolicy(segment);

                    if (declaredCode) {
                        return this.fail(declaredCode, input, segment, raw);
                    }
                }

                return {
                    success: false,
                    code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                    input: raw,
                    segment,
                };
            }

            return this.fail(KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE, input, segment, raw);
        }

        // after the lookup, so a segment that is no relation at all keeps
        // answering SCHEMA_UNRESOLVABLE (and an optional descent still gets
        // its bare verdict) instead of reading as a forbidden relation.
        const policyCode = gated ? this.checkRelationPolicy(segment) : undefined;

        if (policyCode) {
            return this.fail(policyCode, input, segment, raw);
        }

        let schema : ParameterSchema<P, RECORD>;

        if (childBase) {
            schema = childBase[this.parameter] as ParameterSchema<P, RECORD>;
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
            rootSchema: this.rootSchema,
            bound: !!childBase,
            base: childBase,
            rootBase: this.rootBase,
            relations,
            segment,
            path: [...this.path, segment],
            obligationSink: this.obligationSink,
            issueCollector: this.issueCollector,
            depth: this.depth + 1,
            throwOnFailure: this.throwOnFailureContext,
            resolutionThrowOnFailure: this.resolutionThrowOnFailureContext,
            strict: this.strictContext,
        });
    }

    /**
     * Record — into {@link obligationSink}, when present — the relation-
     * authorization obligations a resolved leaf `name` implies: every relation on
     * this scope's absolute {@link path}, plus `name` itself when it is a relation
     * an operator targets directly. Invoked from the {@link resolveKey} leaf case,
     * so it fires exactly once per resolved key across every dialect.
     */
    protected recordObligations(name: string) : void {
        if (!this.obligationSink) {
            return;
        }

        this.obligationSink.push(...this.relationObligations([]));
        this.obligationSink.push(...this.relationObligationForTerminal(name));
    }

    /**
     * The relation-authorization obligations incurred by traversing a resolved
     * relation path: one {@link PendingKeyValidation} per segment, against the
     * governing record's relations sub-schema. The emitted `schema` is the very
     * `RelationsSchema` instance the relations parser records for the same
     * relation (registry identity), so the query-level pass dedups include-driven
     * and traversal-driven obligations for one relation into a single hook call.
     *
     * `relativeSegments` are canonical (alias-resolved) relation names relative to
     * this scope; they are joined onto this scope's absolute {@link path} so the
     * obligation paths are absolute and prune the dependent keys directly — no
     * per-recursion prefixing. Returns `[]` for an unbound scope (no record
     * identity, nothing to authorize). Obligations against a validator-less
     * relations schema are harmless — the evaluation pass skips them.
     */
    protected relationObligations(relativeSegments: string[]) : PendingKeyValidation[] {
        const segments = [...this.path, ...relativeSegments];

        if (segments.length === 0) {
            return [];
        }

        const output : PendingKeyValidation[] = [];
        let base = this.rootBase;
        const prefix : string[] = [];

        for (const segment of segments) {
            if (!base) {
                break;
            }

            prefix.push(segment);
            output.push({
                key: segment,
                path: prefix.join('.'),
                schema: base.relations,
            });

            base = this.registry.get(base.mapSchema(segment));
        }

        return output;
    }

    /**
     * The obligation for a leaf `name` that is *itself* a relation of this
     * scope's record. For the relations parameter the leaf always is one (an
     * include). For fields/filters/sorts it is one only when it maps to a related
     * schema — an operator applied directly to a relation array
     * (`$size`/`$all`/`$elemMatch`) that the backends join; unlike a dotted path,
     * {@link resolveKey} classifies such a leaf as the terminal `name` (empty
     * `path`), so {@link relationObligations} would miss it. Returns `[]` for a
     * scalar / JSON-array leaf (no join). A pure registry lookup — no relation
     * gating, never throws (so it is safe on every resolved leaf, including
     * scalars, regardless of the failure policy).
     */
    protected relationObligationForTerminal(name: string) : PendingKeyValidation[] {
        const base = this.resolveBase();

        if (!base) {
            // a bare relations sub-schema is its own authorization anchor:
            // there is no record schema to reach its hook through, so the
            // obligation is recorded against the schema the chain started
            // from. Without this a standalone relations parse skips the hook
            // entirely and every relation is admitted; using `schema` rather
            // than `rootSchema` would gate the first hop alone, because a
            // descended scope with no registered child falls back to an
            // empty sub-schema carrying no hook.
            if (this.parameter === Parameter.RELATIONS) {
                return [{
                    key: name,
                    path: [...this.path, name].join('.'),
                    schema: this.rootSchema as RelationsSchema<RECORD>,
                }];
            }

            return [];
        }

        if (
            this.parameter !== Parameter.RELATIONS &&
            (
                this.isArrayColumn(name) ||
                !this.registry.get(base.mapSchema(name))
            )
        ) {
            return [];
        }

        return [{
            key: name,
            path: [...this.path, name].join('.'),
            schema: base.relations,
        }];
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
            case Parameter.SORTS:
            case Parameter.SORT: {
                const schema = this.schema as SortsSchema<RECORD>;

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
            case Parameter.GROUPS:
            case Parameter.AGGREGATES:
                // resolved term by term through resolveCallTerm, never by key:
                // refusing here keeps these parameters off the fail-open default.
                return KeyResolutionErrorCode.KEY_NOT_PERMITTED;
            default:
                return undefined;
        }
    }

    /**
     * Schema-policy verdict for traversing the relation `segment` (#1001),
     * read from the schema governing this hop:
     *
     * - filters / sorts: their own `relations` list, falling back to
     *   `relations.allowed`;
     * - fields: `relations.allowed`;
     * - relations, groups, aggregates: governed elsewhere (no verdict).
     *
     * An undeclared list permits the segment unless the scope is strict.
     * An unbound scope describes no record and imposes nothing. The decoded
     * includes are not consulted here: {@link checkSegment} applies an
     * explicitly passed `relations` option on top.
     */
    protected checkRelationPolicy(segment: string) : KeyResolutionErrorCode | undefined {
        if (this.isUnbound()) {
            return undefined;
        }

        let list : string[] | undefined;

        switch (this.parameter as `${Parameter}`) {
            case Parameter.FILTERS:
            case Parameter.SORTS:
            case Parameter.SORT: {
                const schema = this.schema as FiltersSchema<RECORD> | SortsSchema<RECORD>;

                list = schema.relations ?? this.resolveBase()?.relations.allowed;

                break;
            }
            case Parameter.FIELDS:
                list = this.resolveBase()?.relations.allowed;

                break;
            default:
                return undefined;
        }

        if (typeof list === 'undefined') {
            return this.strict ?
                KeyResolutionErrorCode.PATH_NOT_PERMITTED :
                undefined;
        }

        return isPathAllowed(segment, list) ?
            undefined :
            KeyResolutionErrorCode.PATH_NOT_PERMITTED;
    }

    /**
     * Gate a resolved leaf `name` that an array operator (`size`,
     * `elemMatch`, `all`) targets directly. When the leaf is a relation of
     * this scope's record, the operator joins it like a dotted path does, so
     * the same {@link checkRelationPolicy} applies. Only the dialect parser
     * knows the operator, so it calls this for array-operator targets alone:
     * a scalar comparison on a column whose name happens to match a
     * registered schema is never gated here.
     *
     * Returns `undefined` when permitted, otherwise the failure, recorded or
     * thrown under this scope's failure policy like any resolution failure.
     */
    checkRelationTarget(name: string, input: string = name) : KeyResolutionFailure | undefined {
        if (!this.isRelationLeaf(name)) {
            return undefined;
        }

        // the explicit `relations` option narrows a relation target exactly
        // as it narrows a dotted hop into the same relation.
        const code = this.checkSegment(name) ?? this.checkRelationPolicy(name);

        if (!code) {
            return undefined;
        }

        return this.fail(code, input, name);
    }

    /**
     * Whether the leaf `name` is itself a relation of this scope's record
     * (an array operator's target, e.g. `$size` on a relation array). Same
     * registry lookup as {@link relationObligationForTerminal}.
     */
    protected isRelationLeaf(name: string) : boolean {
        const base = this.resolveBase();

        if (!base || this.isArrayColumn(name)) {
            return false;
        }

        return !!this.registry.get(base.mapSchema(name)) ||
            this.isDeclaredRelation(name);
    }

    /**
     * Whether the governing base schema declares `name` a relation without
     * the registry having to resolve it: a `schemaMapping` entry, or a
     * listing in `relations.allowed` or in this parameter's own `relations`
     * option. A relation whose target schema is not registered is still a
     * relation, so an array operator on it is gated like any other (#1001).
     * A name declared nowhere and resolvable nowhere is not a relation
     * (e.g. a JSON array column).
     */
    protected isDeclaredRelation(name: string) : boolean {
        const base = this.resolveBase();

        if (!base || this.isArrayColumn(name)) {
            return false;
        }

        if (base.hasSchemaMapping(name)) {
            return true;
        }

        if (
            base.relations.allowed &&
            base.relations.allowed.includes(name as never)
        ) {
            return true;
        }

        if (
            this.parameter === Parameter.FILTERS ||
            this.parameter === Parameter.SORTS ||
            this.parameter === Parameter.SORT
        ) {
            const { relations } = this.schema as FiltersSchema<RECORD> | SortsSchema<RECORD>;

            return !!relations && relations.includes(name as never);
        }

        return false;
    }

    /**
     * Permission verdict for entering a relation segment: the relations
     * parameter's own allow-list, or, for every other parameter, the
     * explicitly passed `relations` option (undefined: no narrowing). The
     * schema policy follows in {@link checkRelationPolicy}.
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
            rootSchema: this.rootSchema,
            bound: this.bound,
            base: this.base,
            rootBase: this.rootBase,
            relations: this.relations,
            segment,
            path: this.path,
            obligationSink: this.obligationSink,
            issueCollector: this.issueCollector,
            depth: this.depth,
            throwOnFailure: this.throwOnFailureContext,
            resolutionThrowOnFailure: this.resolutionThrowOnFailureContext,
            strict: this.strictContext,
            element: this.element,
        });
    }

    protected fail(
        code: KeyResolutionErrorCode,
        input: string,
        segment?: string,
        raw: string = input,
    ) : KeyResolutionFailure {
        const { throwOnFailure } = this;

        if (throwOnFailure) {
            const failure = KEY_RESOLUTION_FAILURES[code] ??
                KEY_RESOLUTION_FAILURES[KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE];
            const name = segment ?? input;

            const issue : IssueInput = {
                code: failure.code,
                parameter: this.parameter,
                path: segment ? [...this.path, segment] : [...this.path],
                key: raw,
                message: failure.message(name),
            };

            if (this.issueCollector) {
                this.issueCollector.add(issue);
            } else {
                // no trace to finish: a scope built outside a parse still fails
                // where the violation is, exactly as it always did, carrying
                // that position, so a catch can merge it into its own trace.
                throw this.raise(code, name, [
                    buildIssue(issue),
                ]);
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

    /**
     * The error one key-resolution verdict fails with, through the parameter's
     * own static factories, so class, `code` and message stay what the
     * fail-fast path has always thrown.
     */
    protected raise(
        code: KeyResolutionErrorCode,
        name: string,
        issues: readonly Issue[] = [],
    ) : ParseError {
        const error = PARAMETER_ERROR_CLASSES[
            this.parameter as `${Parameter}`
        ];

        switch (code) {
            case KeyResolutionErrorCode.KEY_INVALID:
                return error.keyInvalid(name, issues);
            case KeyResolutionErrorCode.KEY_NOT_PERMITTED:
                return error.keyNotPermitted(name, issues);
            case KeyResolutionErrorCode.PATH_NOT_PERMITTED:
                return error.keyPathNotPermitted(name, issues);
            default:
                return error.keyPathInvalid(name, issues);
        }
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
