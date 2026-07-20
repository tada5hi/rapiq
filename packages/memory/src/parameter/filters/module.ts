/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IFilter,
    IFilterVisitor,
    IFilters,
    IFiltersVisitor,
} from '@rapiq/core';
import {
    interpretPlan,
    planCondition,
} from '@rapiq/core';
import type { Predicate } from '../../types';
import { createBoundPredicate } from './binding';
import { FiltersCompiler } from './compiler';
import type { FiltersVisitorOptions } from './types';

export class FiltersVisitor implements IFiltersVisitor<Predicate>, IFilterVisitor<Predicate> {
    protected options : FiltersVisitorOptions;

    constructor(options: FiltersVisitorOptions = {}) {
        this.options = options;
    }

    visitFilters(expr: IFilters) : Predicate {
        return this.compile(expr);
    }

    visitFilter(expr: IFilter) : Predicate {
        return this.compile(expr);
    }

    // -----------------------------------------------------------

    protected compile(expr: IFilter | IFilters) : Predicate {
        const plan = planCondition(expr, { caseSensitive: this.options.caseSensitive });
        if (!plan) {
            return () => true;
        }

        const compiler = this.createCompiler();
        const evaluate = interpretPlan(plan, compiler);

        return createBoundPredicate(evaluate, compiler.paths);
    }

    protected createCompiler() : FiltersCompiler {
        return new FiltersCompiler();
    }
}
