/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { IFilterVisitor } from '../record';

/**
 * Semantic classification of a filter operator — the row shape of
 * {@link FILTER_OPERATOR_SEMANTICS}. The table is the single source
 * of truth the {@link planCondition} lowering derives its decisions
 * from; backends never branch on operator names.
 */
export type FilterOperatorFamily =    | 'equality' |
    'ordering' |
    'membership' |
    'anchored' |
    'regex' |
    'existence' |
    'arithmetic' |
    'cardinality' |
    'structural';

export type FilterOperatorSemantics = {
    family: FilterOperatorFamily,

    /**
     * Negation twin: this operator is the null-inclusive complement
     * of the named positive operator (complement law). Only set on
     * negated operators; the target must itself be positive.
     */
    complementOf?: `${FilterFieldOperator}`,

    /**
     * Method the per-operator {@link IFilterVisitor} dispatch
     * ({@link Filter.accept}) routes to.
     */
    visitorMethod: Exclude<keyof IFilterVisitor<unknown>, 'visitFilter'>,

    /**
     * Anchored family only: anchor placement of the derived pattern.
     */
    anchor?: { start: boolean, end: boolean },

    /**
     * Ordering family only: accepted three-way comparison range
     * (result of a compare(value, condition) in {-1, 0, 1}).
     */
    compare?: { min: -1 | 0 | 1, max: -1 | 0 | 1 },

    /**
     * Whether the operator participates in the case-insensitive
     * default for string values (equality family + membership).
     */
    foldable: boolean,
};

// -----------------------------------------------------------

/**
 * Comparison primitive of a {@link ComparePlan}.
 */
export type PlanCompareOperator = 'eq' | 'lt' | 'lte' | 'gt' | 'gte';

/**
 * and/or group. `negated` (from `not`/`nor` input compounds) is the
 * EXACT complement of the group verdict — the null-inclusive
 * complement law of negated leaves, extended to whole trees. A
 * backend must render it two-valued: rows where the interior does
 * not evaluate to a match — including null-bearing rows — match the
 * negation (SQL therefore cannot use a bare three-valued `not (…)`).
 */
export type CompoundPlan = {
    kind: 'compound',
    operator: 'and' | 'or',
    negated: boolean,
    /**
     * Never empty — compounds whose children all vanish are lowered
     * to `null` themselves.
     */
    children: ConditionPlan[],
};

/**
 * Verdict known at plan time: `in([])` matches nothing,
 * `nin([])` matches everything, an invalid `mod` value matches
 * nothing (mongo parity).
 */
export type ConstantPlan = {
    kind: 'constant',
    verdict: boolean,
};

/**
 * `exists`, `eq(field, null)` and `ne(field, null)`.
 * `negated` reads IS NOT NULL. `elementwise` distributes the test
 * over array-valued fields by element (the equality family does,
 * `exists` addresses the value itself).
 */
export type NullCheckPlan = {
    kind: 'null-check',
    field: string,
    negated: boolean,
    elementwise: boolean,
};

/**
 * Binary comparison on a scalar. `op` is `'eq'` for the equality
 * family (`negated` marks `ne`; ordering operators are never
 * negated). `caseFold` carries the settled policy verdict — the
 * value is a string and the field is not opted out via
 * `caseSensitive`; backends apply only their remaining capability
 * veto (column foldability) and the folding mechanism.
 *
 * Contract for `negated`: the exact null-inclusive complement of
 * the positive form — null/missing values match.
 */
export type ComparePlan = {
    kind: 'compare',
    field: string,
    op: PlanCompareOperator,
    value: unknown,
    caseFold: boolean,
    negated: boolean,
};

/**
 * `in`/`nin`. `values` is null-free and non-empty; null members are
 * extracted into `includesNull` (they stay leaf-local because a
 * null member participates in element quantification — `in([x, null])`
 * matches an array-valued field containing null).
 *
 * The four-case contract every backend must satisfy:
 * - positive, no null:  v ∈ values
 * - positive, null:     v ∈ values OR v IS NULL
 * - negated, no null:   complement (v ∉ values OR v IS NULL)
 * - negated, null:      v ∉ values AND v IS NOT NULL
 */
export type OneOfPlan = {
    kind: 'one-of',
    field: string,
    values: unknown[],
    includesNull: boolean,
    caseFold: boolean,
    negated: boolean,
};

/**
 * String matching — the anchored family and the regex operator in
 * one node. Anchored literals keep their text so LIKE-only dialects
 * can derive a wildcard pattern; `regexSource` is always a usable
 * POSITIVE pattern (metacharacters escaped, anchors applied — never
 * a negative lookahead; negation is the `negated` flag, with the
 * null-inclusive leaf contract).
 */
export type MatchPattern =    | { mode: 'starts' | 'ends' | 'contains', text: string } |
    {
        mode: 'regex', 
        source: string, 
        flags: string 
    };

export type MatchPlan = {
    kind: 'match',
    field: string,
    pattern: MatchPattern,
    regexSource: string,
    ignoreCase: boolean,
    negated: boolean,
};

/**
 * `mod` — value already validated ([divisor, remainder], finite,
 * divisor non-zero); invalid input lowers to a false constant.
 */
export type ModPlan = {
    kind: 'mod',
    field: string,
    divisor: number,
    remainder: number,
};

/**
 * `size` — addresses the array itself, not its elements.
 * `count` is null when the condition value is invalid (not a
 * non-negative integer): the condition then never matches, but the
 * node keeps its identity so backends without array-length support
 * still fail typed instead of silently rendering a constant.
 */
export type SizePlan = {
    kind: 'size',
    field: string,
    count: number | null,
};

/**
 * `elemMatch` — the interior is recursively planned. ITSELF
 * placement legality is already verified during lowering.
 */
export type ElemMatchPlan = {
    kind: 'elem-match',
    field: string,
    condition: ConditionPlan,
};

export type ConditionPlan =    | CompoundPlan |
    ConstantPlan |
    NullCheckPlan |
    ComparePlan |
    OneOfPlan |
    MatchPlan |
    ModPlan |
    SizePlan |
    ElemMatchPlan;

// -----------------------------------------------------------

/**
 * The backend contract over a {@link ConditionPlan} — and its
 * declared support matrix: an optional handler that is absent means
 * the feature is unsupported ({@link interpretPlan} throws the
 * typed error, in exactly one place). `itself` declares whether
 * leaf fields may be the ITSELF (`$this`) marker.
 *
 * `compound` and `elemMatch` handlers recurse via
 * {@link interpretPlan} on their children.
 */
export interface IPlanInterpreter<R> {
    readonly itself?: boolean;

    compound(plan: CompoundPlan): R;

    constant(plan: ConstantPlan): R;

    nullCheck(plan: NullCheckPlan): R;

    compare(plan: ComparePlan): R;

    oneOf(plan: OneOfPlan): R;

    match(plan: MatchPlan): R;

    mod?(plan: ModPlan): R;

    size?(plan: SizePlan): R;

    elemMatch?(plan: ElemMatchPlan): R;
}

export type PlanConditionOptions = {
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default —
     * matched against the full path composed through elemMatch
     * scopes. `true` keeps every comparison case-sensitive.
     */
    caseSensitive?: string[] | boolean,
};
