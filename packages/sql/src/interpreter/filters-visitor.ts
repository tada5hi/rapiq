/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator, IFilterVisitor, IFiltersVisitor } from 'rapiq';
import { Filter, Filters } from 'rapiq';
import type { IFiltersAdapter } from '../adapter';
import type { FilterInterpreterInterpretOptions } from './filters';

export class FiltersVisitor implements IFiltersVisitor<IFiltersAdapter>,
    IFilterVisitor<IFiltersAdapter> {
    protected adapter : IFiltersAdapter;

    protected options : Omit<FilterInterpreterInterpretOptions, 'interpret'>;

    constructor(
        adapter: IFiltersAdapter,
        options: Omit<FilterInterpreterInterpretOptions, 'interpret'> = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitFilterEqual(expr: Filter<FilterFieldOperator.EQUAL>): IFiltersAdapter {
        return this.adapter.where(expr.field, '=', expr.value);
    }

    visitFilterNotEqual(expr: Filter<FilterFieldOperator.NOT_EQUAL>): IFiltersAdapter {
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
        return this.adapter.whereRaw(
            `${this.adapter.buildField(
                expr.field,
                this.options.rootAlias,
            )} in(${this.adapter.buildParamsPlaceholders(expr.value).join(', ')})`,
            ...expr.value,
        );
    }

    visitFilterNotIn(expr: Filter<FilterFieldOperator.NOT_IN, unknown[]>): IFiltersAdapter {
        return this.adapter.whereRaw(
            `${this.adapter.buildField(
                expr.field,
                this.options.rootAlias,
            )} not in(${this.adapter.buildParamsPlaceholders(expr.value).join(', ')})`,
            ...expr.value,
        );
    }

    visitFilterMod(expr: Filter<FilterFieldOperator.MOD, [number, number]>): IFiltersAdapter {
        const params = this.adapter.buildParamsPlaceholders(expr.value);
        const sql = `mod(${this.adapter.buildField(expr.field)}, ${params[0]}) = ${params[1]}`;
        return this.adapter.whereRaw(sql, ...expr.value);
    }

    visitFilterElemMatch(expr: Filter<FilterFieldOperator.ELEM_MATCH, Filter | Filters>): IFiltersAdapter {
        const oldPrefix = this.adapter.getFieldPrefix();

        this.adapter.setFieldPrefix(`${expr.field}.`);

        expr.value.accept(this);

        this.adapter.setFieldPrefix(oldPrefix);

        return this.adapter;
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
        throw new Error(`The filter operator ${expr.operator} is not supported.`);
    }
}
