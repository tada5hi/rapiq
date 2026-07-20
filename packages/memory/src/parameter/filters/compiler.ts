/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ComparePlan,
    CompoundPlan,
    ConstantPlan,
    ElemMatchPlan,
    IPlanInterpreter,
    MatchPlan,
    ModPlan,
    NullCheckPlan,
    OneOfPlan,
    SizePlan,
} from '@rapiq/core';
import {
    AdapterError,
    FILTER_OPERATOR_SEMANTICS,
    ITSELF,
    interpretPlan,
} from '@rapiq/core';
import {
    compareValues,
    isValueEqual,
    normalizeValue,
    resolveProperty,
    toText,
} from '../../helpers';
import { BINDING_ELEMENT_FLAG, BINDING_SCOPE_SEPARATOR } from './constants';
import type { ConditionEval, ValueTest } from './types';

/**
 * Positive leaf tests treat an array value by element
 * (membership semantics where SQL has no array columns).
 */
function anyValue(test: ValueTest) : ValueTest {
    return (value) => {
        if (Array.isArray(value)) {
            return value.some((element) => test(normalizeValue(element)));
        }

        return test(value);
    };
}

/**
 * Compiles a condition plan into per-binding evaluation functions and
 * collects the relation paths the tree references. Operator semantics
 * (complement law, IN decomposition, case-fold policy, pattern
 * derivation, value validation) are decided by the core lowering —
 * this interpreter only compiles primitives into value tests. Field
 * prefixes compose through elemMatch exactly like the SQL adapter, so
 * conditions sharing a relation path bind to the same array element.
 */
export class FiltersCompiler implements IPlanInterpreter<ConditionEval> {
    public readonly paths : Set<string>;

    public readonly itself = true;

    protected bindingPrefix : string;

    protected scopeSequence : number;

    constructor() {
        this.paths = new Set();
        this.bindingPrefix = '';
        this.scopeSequence = 0;
    }

    // -----------------------------------------------------------

    compound(plan: CompoundPlan) : ConditionEval {
        const children = plan.children.map(
            (child) => interpretPlan(child, this),
        );

        let combined : ConditionEval;
        if (plan.operator === 'or') {
            combined = (ctx, root) => children.some((child) => child(ctx, root));
        } else {
            combined = (ctx, root) => children.every((child) => child(ctx, root));
        }

        if (plan.negated) {
            return (ctx, root) => !combined(ctx, root);
        }

        return combined;
    }

    constant(plan: ConstantPlan) : ConditionEval {
        return () => plan.verdict;
    }

    nullCheck(plan: NullCheckPlan) : ConditionEval {
        const base : ValueTest = (value) => normalizeValue(value) === null;
        const test = plan.elementwise ? anyValue(base) : base;

        return this.leaf(plan.field, this.negate(test, plan.negated));
    }

    compare(plan: ComparePlan) : ConditionEval {
        if (plan.op === 'eq') {
            const test = anyValue(this.buildValueEqualTest(plan.value, plan.caseFold));

            return this.leaf(plan.field, this.negate(test, plan.negated));
        }

        const range = FILTER_OPERATOR_SEMANTICS[plan.op].compare;

        return this.leaf(plan.field, this.buildCompareTest(plan.value, range.min, range.max));
    }

    oneOf(plan: OneOfPlan) : ConditionEval {
        const tests = plan.values.map(
            (value) => this.buildValueEqualTest(value, plan.caseFold),
        );
        if (plan.includesNull) {
            tests.push((value) => isValueEqual(value, null));
        }

        const test = anyValue(
            (value) => tests.some((item) => item(value)),
        );

        return this.leaf(plan.field, this.negate(test, plan.negated));
    }

    match(plan: MatchPlan) : ConditionEval {
        let regex : RegExp;
        if (plan.pattern.mode === 'regex') {
            try {
                regex = new RegExp(plan.pattern.source, plan.pattern.flags);
            } catch {
                throw AdapterError.featureUnsupported('filters:regex:value');
            }
        } else {
            regex = new RegExp(plan.regexSource, 'i');
        }

        const test = anyValue((value) => {
            const text = toText(value);
            if (text === undefined) {
                return false;
            }

            return regex.test(text);
        });

        return this.leaf(plan.field, this.negate(test, plan.negated));
    }

    mod(plan: ModPlan) : ConditionEval {
        return this.leaf(plan.field, anyValue(
            (value) => typeof value === 'number' &&
                Number.isFinite(value) &&
                value % plan.divisor === plan.remainder,
        ));
    }

    size(plan: SizePlan) : ConditionEval {
        if (plan.count === null) {
            return this.leaf(plan.field, () => false);
        }

        const { count } = plan;

        // the condition addresses the array itself, not its elements —
        // missing or non-array values never match (mongo parity).
        return this.leaf(plan.field, (value) => Array.isArray(value) &&
            value.length === count);
    }

    elemMatch(plan: ElemMatchPlan) : ConditionEval {
        const oldBindingPrefix = this.bindingPrefix;

        // every elemMatch opens its own quantifier scope: the
        // discriminated segment gives this interior an element binding
        // of its own, so two elemMatches on one field quantify
        // independently (e.g. one per $all value).
        this.scopeSequence += 1;
        this.bindingPrefix = `${oldBindingPrefix}${plan.field}${BINDING_SCOPE_SEPARATOR}${this.scopeSequence}.`;

        try {
            return interpretPlan(plan.condition, this);
        } finally {
            this.bindingPrefix = oldBindingPrefix;
        }
    }

    // -----------------------------------------------------------

    protected leaf(field: string, test: ValueTest) : ConditionEval {
        if (field === ITSELF) {
            // the marker addresses the element bound by the enclosing
            // elemMatch scope; outside one it has no referent.
            if (!this.bindingPrefix) {
                throw AdapterError.featureUnsupported('filters:itself');
            }

            const path = this.bindingPrefix.slice(0, -1);
            const flag = `${path}${BINDING_ELEMENT_FLAG}`;

            this.registerPath(path);

            return (ctx) => ctx.get(flag) === true &&
                test(normalizeValue(ctx.get(path)));
        }

        const key = `${this.bindingPrefix}${field}`;
        const separatorIndex = key.lastIndexOf('.');

        if (separatorIndex === -1) {
            return (_ctx, root) => test(resolveProperty(root, key));
        }

        const path = key.slice(0, separatorIndex);
        const name = key.slice(separatorIndex + 1);

        this.registerPath(path);

        return (ctx) => test(resolveProperty(ctx.get(path), name));
    }

    protected registerPath(path: string) : void {
        const segments = path.split('.');

        for (let i = 0; i < segments.length; i++) {
            this.paths.add(segments.slice(0, i + 1).join('.'));
        }
    }

    // -----------------------------------------------------------

    /**
     * Complement law: the negation wraps OUTSIDE element
     * quantification, so a negated leaf is the exact complement of
     * its positive twin — null/missing values match.
     */
    protected negate(test: ValueTest, negated: boolean) : ValueTest {
        if (negated) {
            return (value) => !test(value);
        }

        return test;
    }

    /**
     * Single-value equality: `caseFold` carries the settled policy
     * verdict (string condition, field not opted out) — string
     * comparisons then fold on both sides, mirroring the SQL
     * adapter's lower()-wrapped rendering.
     */
    protected buildValueEqualTest(input: unknown, caseFold: boolean) : ValueTest {
        const condition = normalizeValue(input);

        if (
            caseFold &&
            typeof condition === 'string'
        ) {
            const lowered = condition.toLowerCase();

            return (value) => typeof value === 'string' &&
                value.toLowerCase() === lowered;
        }

        return (value) => isValueEqual(value, condition);
    }

    protected buildCompareTest(input: unknown, min: number, max: number) : ValueTest {
        const condition = normalizeValue(input);

        return anyValue((value) => {
            const result = compareValues(value, condition);
            if (result === undefined) {
                return false;
            }

            return result >= min && result <= max;
        });
    }
}
