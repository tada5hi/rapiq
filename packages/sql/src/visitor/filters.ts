/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ComparePlan,
    CompoundPlan,
    ConstantPlan,
    ElemMatchPlan,
    ICondition,
    IFilterVisitor,
    IFiltersVisitor,
    IPlanInterpreter,
    MatchPlan,
    ModPlan,
    NullCheckPlan,
    OneOfPlan,
    PlanCompareOperator,
} from '@rapiq/core';
import {
    interpretPlan,
    planCondition,
} from '@rapiq/core';
import type { IFiltersAdapter } from '../adapter';
import { escapeLikePattern } from '../helpers';
import type { VisitorOptions } from './types';

const COMPARE_SYMBOLS : Record<PlanCompareOperator, string> = {
    eq: '=',
    lt: '<',
    lte: '<=',
    gt: '>',
    gte: '>=',
};

/**
 * Renders a condition tree into SQL fragments by interpreting its
 * {@link ConditionPlan}: operator semantics (complement law, IN
 * decomposition, case-fold policy, pattern derivation, value
 * validation) are decided by the core lowering — this visitor only
 * renders primitives through the adapter's dialect hooks.
 */
export class FiltersVisitor implements IFiltersVisitor<IFiltersAdapter>,
    IFilterVisitor<IFiltersAdapter>,
    IPlanInterpreter<IFiltersAdapter> {
    protected adapter : IFiltersAdapter;

    protected options : VisitorOptions;

    constructor(
        adapter: IFiltersAdapter,
        options: VisitorOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    // -----------------------------------------------------------

    visitFilters(expr: ICondition): IFiltersAdapter {
        return this.run(expr);
    }

    visitFilter(expr: ICondition): IFiltersAdapter {
        return this.run(expr);
    }

    protected run(expr: ICondition) : IFiltersAdapter {
        const plan = planCondition(expr, { caseSensitive: this.options.caseSensitive });
        if (!plan) {
            return this.adapter;
        }

        return interpretPlan(plan, this);
    }

    // -----------------------------------------------------------

    compound(plan: CompoundPlan): IFiltersAdapter {
        const adapter = this.adapter.child();
        const visitor = new FiltersVisitor(adapter, this.options);

        for (const child of plan.children) {
            interpretPlan(child, visitor);
        }

        this.adapter.merge(adapter, plan.operator, plan.negated);

        return adapter;
    }

    constant(plan: ConstantPlan): IFiltersAdapter {
        return this.adapter.whereRaw(plan.verdict ? '1 = 1' : '1 = 0');
    }

    nullCheck(plan: NullCheckPlan): IFiltersAdapter {
        return this.adapter.whereRaw(
            `${this.adapter.buildField(plan.field)} is ${plan.negated ? 'not ' : ''}null`,
        );
    }

    compare(plan: ComparePlan): IFiltersAdapter {
        const fold = plan.caseFold && this.isCaseFoldableField(plan.field);

        if (plan.negated) {
            const field = this.adapter.buildField(plan.field);
            const placeholder = this.adapter.buildParamPlaceholder();
            const sql = fold ?
                `${this.adapter.caseFold(field)} <> ${this.adapter.caseFold(placeholder)}` :
                `${field} <> ${placeholder}`;

            return this.whereComplement(field, sql, plan.value);
        }

        if (fold) {
            const field = this.adapter.buildField(plan.field);

            return this.adapter.whereRaw(
                `${this.adapter.caseFold(field)} = ${this.adapter.caseFold(this.adapter.buildParamPlaceholder())}`,
                plan.value,
            );
        }

        return this.adapter.where(plan.field, COMPARE_SYMBOLS[plan.op], plan.value);
    }

    /**
     * Render the IN/NOT IN four-case contract: a null member also
     * matches the absence of a value (IS NULL); the negated form is
     * the exact complement.
     */
    oneOf(plan: OneOfPlan): IFiltersAdapter {
        const { values } = plan;
        const field = this.adapter.buildField(plan.field);
        const nullCondition = `${field} is ${plan.negated ? 'not ' : ''}null`;

        let inCondition : string;
        if (
            plan.caseFold &&
            this.isCaseFoldableField(plan.field) &&
            values.some((value) => typeof value === 'string')
        ) {
            const placeholders = values.map((value) => {
                const placeholder = this.adapter.buildParamPlaceholder();
                return typeof value === 'string' ? this.adapter.caseFold(placeholder) : placeholder;
            });
            inCondition = `${this.adapter.caseFold(field)} ${plan.negated ? 'not ' : ''}in(${placeholders.join(', ')})`;
        } else {
            inCondition = `${field} ${plan.negated ? 'not ' : ''}in(${this.adapter.buildParamsPlaceholders(values).join(', ')})`;
        }

        if (!plan.includesNull) {
            if (plan.negated) {
                return this.whereComplement(field, inCondition, ...values);
            }

            return this.adapter.whereRaw(inCondition, ...values);
        }

        return this.adapter.whereRaw(
            `(${inCondition} ${plan.negated ? 'and' : 'or'} ${nullCondition})`,
            ...values,
        );
    }

    match(plan: MatchPlan): IFiltersAdapter {
        if (
            plan.pattern.mode !== 'regex' &&
            !this.adapter.isRegexpSupported()
        ) {
            const escaped = escapeLikePattern(plan.pattern.text);

            let pattern : string;
            if (plan.pattern.mode === 'starts') {
                pattern = `${escaped}%`;
            } else if (plan.pattern.mode === 'ends') {
                pattern = `%${escaped}`;
            } else {
                pattern = `%${escaped}%`;
            }

            return this.whereLike(plan.field, pattern, plan.negated);
        }

        const field = this.adapter.buildField(plan.field);
        const sql = this.adapter.regexp(
            field,
            this.adapter.buildParamPlaceholder(),
            plan.ignoreCase,
        );

        if (plan.negated) {
            return this.whereComplement(field, `not (${sql})`, plan.regexSource);
        }

        return this.adapter.whereRaw(sql, plan.regexSource);
    }

    mod(plan: ModPlan): IFiltersAdapter {
        const values : [number, number] = [plan.divisor, plan.remainder];
        const params = this.adapter.buildParamsPlaceholders(values);
        const sql = `mod(${this.adapter.buildField(plan.field)}, ${params[0]}) = ${params[1]}`;

        return this.adapter.whereRaw(sql, ...values);
    }

    // no `size` handler: an array-length check needs per-dialect
    // JSON-array support (json_array_length/JSON_LENGTH/cardinality).
    // no `itself` declaration: a joined relation row is not a scalar
    // column, so SQL has no rendering for the element itself.

    elemMatch(plan: ElemMatchPlan): IFiltersAdapter {
        const oldPrefix = this.adapter.getFieldPrefix();

        this.adapter.setFieldPrefix(`${oldPrefix}${plan.field}.`);

        try {
            return interpretPlan(plan.condition, this);
        } finally {
            this.adapter.setFieldPrefix(oldPrefix);
        }
    }

    // -----------------------------------------------------------

    protected whereLike(field: string, pattern: string, negated: boolean) : IFiltersAdapter {
        const fieldBuilt = this.adapter.buildField(field);
        const condition = `${fieldBuilt} ${negated ? 'not ' : ''}like ${this.adapter.buildParamPlaceholder()} escape '\\'`;
        if (negated) {
            return this.whereComplement(fieldBuilt, condition, pattern);
        }

        return this.adapter.whereRaw(condition, pattern);
    }

    /**
     * Render a negated condition null-inclusively. Negated operators
     * are exact complements of their positive twins (complement
     * law), but the bare SQL negation follows three-valued logic
     * and drops NULL rows.
     */
    protected whereComplement(field: string, sql: string, ...values: unknown[]) : IFiltersAdapter {
        return this.adapter.whereRaw(`(${sql} or ${field} is null)`, ...values);
    }

    /**
     * The adapter-side capability veto on the fold policy: backends
     * with column metadata exempt non-string columns.
     */
    protected isCaseFoldableField(field: string) : boolean {
        return this.adapter.isCaseFoldable(`${this.adapter.getFieldPrefix()}${field}`);
    }
}
