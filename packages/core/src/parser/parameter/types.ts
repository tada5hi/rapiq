import type { Parameter } from '../../constants';
import type { ParseError } from '../../errors';
import type { ICondition } from '../../parameter';
import type { IIssueCollector } from '../issue';
import type { KeyValidationVerdict, KeyValidationVerdictRecord } from '../../schema';
import type { MaybeAsync } from '../../types';

/**
 * The slice of a parameter schema the key-validation pass consumes —
 * implemented by RelationsSchema, FieldsSchema and SortsSchema. The
 * batched members are optional, so an external implementation without
 * them stays source compatible and is simply driven per key.
 */
export type KeyValidatableSchema = {
    readonly name?: string,
    /**
     * The parameter this schema governs. Declared once by the schema
     * (the sub-schema classes set it in their constructors); the
     * driver derives the condition rules from it per entry, so mixed
     * obligation pools (a relation ledger fed by every parameter) need
     * no caller-side annotation.
     */
    readonly parameter: `${Parameter}`,
    hasValidator() : boolean,
    hasManyValidator?() : boolean,
    /**
     * The caller supplies only the dotted relation path of the position
     * being validated (`''` at the query root); the schema completes the
     * {@link KeyValidationScope} its hook receives from what it already
     * knows about itself. The path is REQUIRED on this driver contract:
     * an omitted path would silently claim the root position, which
     * fails open for an allow-at-root hook. (The schema classes default
     * it for direct human calls; a defaulted method still satisfies the
     * required signature.)
     */
    validate(
        name: string,
        context: any,
        path: string,
    ) : MaybeAsync<KeyValidationVerdict>,
    validateMany?(
        names: string[],
        context: any,
        path: string,
    ) : MaybeAsync<KeyValidationVerdictRecord>,
};

/**
 * A client-requested key whose governing schema may carry a validate
 * hook. Parsers record one entry per resolved key during resolution
 * and evaluate them once the parameter is assembled, so the sync and
 * async entry points share a single resolution pass.
 */
export type PendingKeyValidation = {
    /**
     * The hook argument — the canonical key relative to the schema
     * that governs it (the target schema for dotted input).
     */
    key: string,
    /**
     * Final dotted output name; parsers prefix it with the relation
     * segment while their recursion unwinds. Used for pruning.
     */
    path: string,
    schema: KeyValidatableSchema,
    /**
     * The failure policy of the scope that resolved this key, recorded
     * at push time so a child schema's own `throwOnFailure` governs its
     * rejections even inside a pooled pending list. Falls back to the
     * pass-wide {@link KeyValidationOptions.throwOnFailure} when absent
     * (the relation ledger, whose policy is the root relations schema's
     * by contract).
     */
    throwOnFailure?: boolean,
};

export type KeyValidationOptions = {
    throwOnFailure: boolean,
    errors: typeof ParseError,
    /**
     * Trace of the enclosing parse. A rejection records an issue there and
     * lets the parse continue on the drop path; the owning call raises it.
     */
    issueCollector?: IIssueCollector,
    /**
     * Sink for the conditions of condition-gated keys, keyed by output
     * path. Supplied by callers that can carry a condition onward (the
     * fields parsers, onto the `Field` node). Absent means a condition
     * verdict has nowhere to go and counts as a rejection.
     */
    conditions?: Map<string, ICondition>,
};

/**
 * The slice of a groups or aggregates schema the call validation pass
 * consumes.
 */
export type CallValidatableSchema<NODE> = {
    hasValidator() : boolean,
    validate(node: NODE, context: any) : MaybeAsync<KeyValidationVerdict>,
};
