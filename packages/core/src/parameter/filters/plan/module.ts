/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '../../../errors';
import type { IFilters } from '../collection';
import { isFilters } from '../collection';
import type { ICondition } from '../condition';
import { ITSELF } from '../constants';
import type { IFilter } from '../record';
import { isFilter } from '../record';
import { FilterRegexFlag, createFilterRegexPattern } from '../regex';
import { FILTER_OPERATOR_SEMANTICS } from './constants';
import type {
    ConditionPlan,
    IPlanInterpreter,
    MatchPlan,
    PlanCompareOperator,
    PlanConditionOptions,
} from './types';

/**
 * Lower a condition tree (`IFilter | IFilters`) into a
 * {@link ConditionPlan} with every semantic policy decision already
 * made: negation twins resolved to `negated` leaf flags, null
 * equality turned into null checks, in/nin decomposed (empty list,
 * null members), the case-fold policy verdict computed, anchored
 * operators derived into positive patterns, value shapes validated
 * and ITSELF placement checked.
 *
 * Backends interpret the plan via {@link interpretPlan} — they
 * render or compile primitives, they never re-derive operator
 * semantics.
 *
 * Returns `null` when the tree is empty (an empty compound
 * vanishes).
 */
export function planCondition(
    input: ICondition,
    options: PlanConditionOptions = {},
) : ConditionPlan | null {
    return new ConditionLowering(options).lower(input);
}

/**
 * Dispatch a plan node to the matching interpreter handler.
 *
 * The single support-enforcement point: a missing optional handler
 * (`mod`/`size`/`elemMatch`) and an ITSELF leaf without the
 * `itself` declaration throw the typed feature error here — never
 * inside a backend.
 */
export function interpretPlan<R>(
    plan: ConditionPlan,
    interpreter: IPlanInterpreter<R>,
) : R {
    if (
        'field' in plan &&
        plan.field === ITSELF &&
        !interpreter.itself
    ) {
        throw AdapterError.featureUnsupported('filters:itself');
    }

    switch (plan.kind) {
        case 'compound': {
            return interpreter.compound(plan);
        }
        case 'constant': {
            return interpreter.constant(plan);
        }
        case 'null-check': {
            return interpreter.nullCheck(plan);
        }
        case 'compare': {
            return interpreter.compare(plan);
        }
        case 'one-of': {
            return interpreter.oneOf(plan);
        }
        case 'match': {
            return interpreter.match(plan);
        }
        case 'mod': {
            if (!interpreter.mod) {
                throw AdapterError.featureUnsupported('filters:mod');
            }

            return interpreter.mod(plan);
        }
        case 'size': {
            if (!interpreter.size) {
                throw AdapterError.featureUnsupported('filters:size');
            }

            return interpreter.size(plan);
        }
        case 'elem-match': {
            if (!interpreter.elemMatch) {
                throw AdapterError.featureUnsupported('filters:elemMatch');
            }

            return interpreter.elemMatch(plan);
        }
        default: {
            throw AdapterError.featureUnsupported(
                `filters:${(plan as { kind: string }).kind}`,
            );
        }
    }
}

// -----------------------------------------------------------

class ConditionLowering {
    protected caseSensitiveAll : boolean;

    protected caseSensitiveFields : Set<string>;

    protected fieldPrefix : string;

    protected elementDepth : number;

    constructor(options: PlanConditionOptions) {
        this.caseSensitiveAll = options.caseSensitive === true;
        this.caseSensitiveFields = new Set(
            Array.isArray(options.caseSensitive) ? options.caseSensitive : [],
        );
        this.fieldPrefix = '';
        this.elementDepth = 0;
    }

    // -----------------------------------------------------------

    lower(input: ICondition) : ConditionPlan | null {
        if (isFilters(input)) {
            return this.lowerCompound(input);
        }

        if (isFilter(input)) {
            return this.lowerLeaf(input);
        }

        throw AdapterError.operatorUnsupported(String(
            (input as Partial<ICondition>)?.operator,
        ));
    }

    // -----------------------------------------------------------

    protected lowerCompound(input: IFilters) : ConditionPlan | null {
        let operator : 'and' | 'or';
        let negated = false;

        switch (input.operator) {
            case 'and': {
                operator = 'and';
                break;
            }
            case 'or': {
                operator = 'or';
                break;
            }
            // plain boolean NOT over the group; the null-inclusive
            // complement law applies to negated LEAF operators only.
            case 'nor': {
                operator = 'or';
                negated = true;
                break;
            }
            case 'not': {
                operator = 'and';
                negated = true;
                break;
            }
            default: {
                throw AdapterError.operatorUnsupported(input.operator);
            }
        }

        const children : ConditionPlan[] = [];
        for (let i = 0; i < input.value.length; i++) {
            const child = input.value[i];
            if (!child) {
                continue;
            }

            if (isFilter(child) || isFilters(child)) {
                const plan = this.lower(child);
                if (plan) {
                    children.push(plan);
                }
            }
        }

        // an empty compound vanishes.
        if (children.length === 0) {
            return null;
        }

        return {
            kind: 'compound', 
            operator, 
            negated, 
            children,
        };
    }

    // -----------------------------------------------------------

    protected lowerLeaf(input: IFilter) : ConditionPlan | null {
        const semantics = FILTER_OPERATOR_SEMANTICS[
            input.operator as keyof typeof FILTER_OPERATOR_SEMANTICS
        ];
        if (!semantics) {
            throw AdapterError.operatorUnsupported(input.operator);
        }

        // the ITSELF marker addresses the element bound by an
        // enclosing elemMatch scope; outside one it has no referent.
        if (input.field === ITSELF && this.elementDepth === 0) {
            throw AdapterError.featureUnsupported('filters:itself');
        }

        const negated = typeof (
            semantics as { complementOf?: string }
        ).complementOf === 'string';

        // a single absent value: unify undefined and null so every
        // downstream decision only reasons about null.
        const value = input.value === undefined ? null : input.value;

        switch (semantics.family) {
            case 'equality': {
                if (value === null) {
                    return {
                        kind: 'null-check', 
                        field: input.field, 
                        negated, 
                        elementwise: true,
                    };
                }

                return {
                    kind: 'compare',
                    field: input.field,
                    op: 'eq',
                    value,
                    caseFold: typeof value === 'string' && this.isFoldableField(input.field),
                    negated,
                };
            }
            case 'ordering': {
                return {
                    kind: 'compare',
                    field: input.field,
                    op: input.operator as PlanCompareOperator,
                    value,
                    caseFold: false,
                    negated: false,
                };
            }
            case 'membership': {
                return this.lowerMembership(input.field, value, negated);
            }
            case 'anchored': {
                const anchor = (
                    semantics as { anchor?: { start: boolean, end: boolean } }
                ).anchor || { start: false, end: false };
                const text = `${value}`;

                let mode : 'starts' | 'ends' | 'contains';
                let flag : number;
                if (anchor.start) {
                    mode = 'starts';
                    flag = FilterRegexFlag.STARTS_WITH;
                } else if (anchor.end) {
                    mode = 'ends';
                    flag = FilterRegexFlag.ENDS_WITH;
                } else {
                    mode = 'contains';
                    flag = FilterRegexFlag.CONTAINS;
                }

                return {
                    kind: 'match',
                    field: input.field,
                    pattern: { mode, text },
                    regexSource: createFilterRegexPattern(text, flag),
                    ignoreCase: true,
                    negated,
                };
            }
            case 'regex': {
                return this.lowerRegex(input.field, value);
            }
            case 'existence': {
                return {
                    kind: 'null-check', 
                    field: input.field, 
                    negated: !!value, 
                    elementwise: false,
                };
            }
            case 'arithmetic': {
                return this.lowerMod(input.field, value);
            }
            case 'cardinality': {
                const valid = typeof value === 'number' &&
                    Number.isInteger(value) &&
                    value >= 0;

                return {
                    kind: 'size',
                    field: input.field,
                    count: valid ? value as number : null,
                };
            }
            case 'structural': {
                return this.lowerElemMatch(input);
            }
            default: {
                throw AdapterError.operatorUnsupported(input.operator);
            }
        }
    }

    protected lowerMembership(
        field: string,
        value: unknown,
        negated: boolean,
    ) : ConditionPlan {
        if (!Array.isArray(value) || value.length === 0) {
            return { kind: 'constant', verdict: negated };
        }

        const normalized = value.map(
            (item) => (item === undefined ? null : item),
        );
        const values = normalized.filter((item) => item !== null);

        if (values.length === 0) {
            return {
                kind: 'null-check', 
                field, 
                negated, 
                elementwise: true,
            };
        }

        return {
            kind: 'one-of',
            field,
            values,
            includesNull: values.length !== normalized.length,
            caseFold: this.isFoldableField(field),
            negated,
        };
    }

    protected lowerRegex(field: string, value: unknown) : MatchPlan {
        if (value instanceof RegExp) {
            // strip the stateful flags, so repeated test() calls
            // never depend on lastIndex.
            const flags = value.flags.replace(/[gy]/g, '');

            return {
                kind: 'match',
                field,
                pattern: {
                    mode: 'regex', 
                    source: value.source, 
                    flags, 
                },
                regexSource: value.source,
                ignoreCase: value.ignoreCase,
                negated: false,
            };
        }

        // a string pattern passes through unvalidated — the
        // consuming engine (database or RegExp) interprets it.
        if (typeof value === 'string') {
            return {
                kind: 'match',
                field,
                pattern: {
                    mode: 'regex', 
                    source: value, 
                    flags: '', 
                },
                regexSource: value,
                ignoreCase: false,
                negated: false,
            };
        }

        throw AdapterError.featureUnsupported('filters:regex:value');
    }

    protected lowerMod(field: string, value: unknown) : ConditionPlan {
        if (
            !Array.isArray(value) ||
            value.length !== 2 ||
            typeof value[0] !== 'number' ||
            !Number.isFinite(value[0]) ||
            typeof value[1] !== 'number' ||
            !Number.isFinite(value[1]) ||
            value[0] === 0
        ) {
            // a malformed divisor/remainder pair matches nothing
            // (mongo parity), on every backend.
            return { kind: 'constant', verdict: false };
        }

        return {
            kind: 'mod', 
            field, 
            divisor: value[0], 
            remainder: value[1],
        };
    }

    protected lowerElemMatch(input: IFilter) : ConditionPlan | null {
        const interior = input.value;
        if (
            !isFilter(interior) &&
            !isFilters(interior as ICondition)
        ) {
            throw AdapterError.featureUnsupported('filters:elemMatch:value');
        }

        const oldPrefix = this.fieldPrefix;

        this.fieldPrefix = `${oldPrefix}${input.field}.`;
        this.elementDepth += 1;

        try {
            const condition = this.lower(interior as ICondition);
            if (!condition) {
                return null;
            }

            return {
                kind: 'elem-match', 
                field: input.field, 
                condition, 
            };
        } finally {
            this.fieldPrefix = oldPrefix;
            this.elementDepth -= 1;
        }
    }

    // -----------------------------------------------------------

    /**
     * The settled case policy: equality-family comparisons on the
     * field fold unless opted out via `caseSensitive` (matched on
     * the full path composed through elemMatch scopes). Backends
     * apply only their remaining capability veto.
     */
    protected isFoldableField(field: string) : boolean {
        if (this.caseSensitiveAll) {
            return false;
        }

        return !this.caseSensitiveFields.has(`${this.fieldPrefix}${field}`);
    }
}
