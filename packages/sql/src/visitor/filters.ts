/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IFilterVisitor,
    IFiltersVisitor,
} from '@rapiq/core';
import {
    AdapterError,
    Filter,
    FilterFieldOperator,

    FilterRegexFlag,
    Filters,
    createFilterRegex,
} from '@rapiq/core';
import type { IFiltersAdapter } from '../adapter';
import { escapeLikePattern } from '../helpers';
import type { VisitorOptions } from './types';

export class FiltersVisitor implements IFiltersVisitor<IFiltersAdapter>,
    IFilterVisitor<IFiltersAdapter> {
    protected adapter : IFiltersAdapter;

    protected options : VisitorOptions;

    constructor(
        adapter: IFiltersAdapter,
        options: VisitorOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitFilterEqual(expr: Filter<FilterFieldOperator.EQUAL>): IFiltersAdapter {
        if (expr.value === null) {
            return this.adapter.whereRaw(`${this.adapter.buildField(expr.field)} is null`);
        }

        return this.adapter.where(expr.field, '=', expr.value);
    }

    visitFilterNotEqual(expr: Filter<FilterFieldOperator.NOT_EQUAL>): IFiltersAdapter {
        if (expr.value === null) {
            return this.adapter.whereRaw(`${this.adapter.buildField(expr.field)} is not null`);
        }

        return this.adapter.where(expr.field, '<>', expr.value);
    }

    visitFilterLessThan(expr: Filter<FilterFieldOperator.LESS_THAN>): IFiltersAdapter {
        return this.adapter.where(expr.field, '<', expr.value);
    }

    visitFilterLessThanEqual(expr: Filter<FilterFieldOperator.LESS_THAN_EQUAL>): IFiltersAdapter {
        return this.adapter.where(expr.field, '<=', expr.value);
    }

    visitFilterGreaterThan(expr: Filter<FilterFieldOperator.GREATER_THAN>): IFiltersAdapter {
        return this.adapter.where(expr.field, '>', expr.value);
    }

    visitFilterGreaterThanEqual(expr: Filter<FilterFieldOperator.GREATER_THAN_EQUAL>): IFiltersAdapter {
        return this.adapter.where(expr.field, '>=', expr.value);
    }

    visitFilterExists(expr: Filter<FilterFieldOperator.EXISTS, boolean>): IFiltersAdapter {
        return this.adapter.whereRaw(`${this.adapter.buildField(expr.field)} is ${expr.value ? 'not ' : ''}null`);
    }

    visitFilterIn(expr: Filter<FilterFieldOperator.IN, unknown[]>): IFiltersAdapter {
        return this.whereIn(expr.field, expr.value, false);
    }

    visitFilterNotIn(expr: Filter<FilterFieldOperator.NOT_IN, unknown[]>): IFiltersAdapter {
        return this.whereIn(expr.field, expr.value, true);
    }

    visitFilterMod(expr: Filter<FilterFieldOperator.MOD, [number, number]>): IFiltersAdapter {
        const params = this.adapter.buildParamsPlaceholders(expr.value);
        const sql = `mod(${this.adapter.buildField(expr.field)}, ${params[0]}) = ${params[1]}`;
        return this.adapter.whereRaw(sql, ...expr.value);
    }

    visitFilterElemMatch(expr: Filter<FilterFieldOperator.ELEM_MATCH, Filter | Filters>): IFiltersAdapter {
        const oldPrefix = this.adapter.getFieldPrefix();

        this.adapter.setFieldPrefix(`${oldPrefix}${expr.field}.`);

        expr.value.accept(this);

        this.adapter.setFieldPrefix(oldPrefix);

        return this.adapter;
    }

    visitFilterStartsWith(expr: Filter<FilterFieldOperator.STARTS_WITH, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.STARTS_WITH);
    }

    visitFilterNotStartsWith(expr: Filter<FilterFieldOperator.NOT_STARTS_WITH, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.STARTS_WITH | FilterRegexFlag.NEGATION);
    }

    visitFilterEndsWith(expr: Filter<FilterFieldOperator.ENDS_WITH, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.ENDS_WITH);
    }

    visitFilterNotEndsWith(expr: Filter<FilterFieldOperator.NOT_ENDS_WITH, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.ENDS_WITH | FilterRegexFlag.NEGATION);
    }

    visitFilterContains(expr: Filter<FilterFieldOperator.CONTAINS, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.CONTAINS);
    }

    visitFilterNotContains(expr: Filter<FilterFieldOperator.NOT_CONTAINS, unknown>): IFiltersAdapter {
        return this.whereAnchored(expr.field, expr.value, FilterRegexFlag.CONTAINS | FilterRegexFlag.NEGATION);
    }

    visitFilterRegex(expr: Filter<FilterFieldOperator.REGEX, RegExp>): IFiltersAdapter {
        const sql = this.adapter.regexp(
            this.adapter.buildField(expr.field),
            this.adapter.buildParamPlaceholder(),
            expr.value.ignoreCase,
        );

        return this.adapter.whereRaw(sql, expr.value.source);
    }

    visitFilters(expr: Filters): IFiltersAdapter {
        const adapter = this.adapter.child();
        const visitor = new FiltersVisitor(
            adapter,
            this.options,
        );

        for (let i = 0; i < expr.value.length; i++) {
            const child = expr.value[i];
            if (child instanceof Filter) {
                child.accept(visitor);
            }

            if (child instanceof Filters) {
                child.accept(visitor);
            }
        }

        switch (expr.operator) {
            case 'or': {
                this.adapter.merge(
                    adapter,
                    'or',
                );
                break;
            }
            case 'nor': {
                this.adapter.merge(
                    adapter,
                    'or',
                    true,
                );
                break;
            }
            case 'not': {
                this.adapter.merge(
                    adapter,
                    'and',
                    true,
                );
                break;
            }
            default: {
                this.adapter.merge(
                    adapter,
                    'and',
                );
            }
        }

        return adapter;
    }

    visitFilter(expr: Filter): IFiltersAdapter {
        throw AdapterError.operatorUnsupported(expr.operator);
    }

    // -----------------------------------------------------------

    /**
     * Render an IN/NOT IN condition.
     * A null element also matches the absence of a value (IS NULL);
     * an empty list matches no row (every row when negated).
     */
    protected whereIn(fieldName: string, input: unknown[], negated: boolean) : IFiltersAdapter {
        if (input.length === 0) {
            return this.adapter.whereRaw(negated ? '1 = 1' : '1 = 0');
        }

        const values = input.filter((value) => value !== null);
        const field = this.adapter.buildField(fieldName);
        const nullCondition = `${field} is ${negated ? 'not ' : ''}null`;
        if (values.length === 0) {
            return this.adapter.whereRaw(nullCondition);
        }

        const inCondition = `${field} ${negated ? 'not ' : ''}in(${this.adapter.buildParamsPlaceholders(values).join(', ')})`;
        if (values.length === input.length) {
            return this.adapter.whereRaw(inCondition, ...values);
        }

        return this.adapter.whereRaw(
            `(${inCondition} ${negated ? 'and' : 'or'} ${nullCondition})`,
            ...values,
        );
    }

    /**
     * Render a startsWith/endsWith/contains condition (or its negation)
     * as a regexp condition, falling back to LIKE on regexp-less dialects.
     */
    protected whereAnchored(field: string, value: unknown, flag: number) : IFiltersAdapter {
        if (!this.adapter.isRegexpSupported()) {
            const escaped = escapeLikePattern(`${value}`);

            let pattern : string;
            if (flag & FilterRegexFlag.STARTS_WITH) {
                pattern = `${escaped}%`;
            } else if (flag & FilterRegexFlag.ENDS_WITH) {
                pattern = `%${escaped}`;
            } else {
                pattern = `%${escaped}%`;
            }

            return this.whereLike(field, pattern, !!(flag & FilterRegexFlag.NEGATION));
        }

        const regex = createFilterRegex(`${value}`, flag);

        return this.visitFilterRegex(new Filter(FilterFieldOperator.REGEX, field, regex));
    }

    protected whereLike(field: string, pattern: string, negated = false) : IFiltersAdapter {
        return this.adapter.whereRaw(
            `${this.adapter.buildField(field)} ${negated ? 'not ' : ''}like ${this.adapter.buildParamPlaceholder()} escape '\\'`,
            pattern,
        );
    }
}
