/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
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

    /**
     * Compile any condition node — a leaf `IFilter`, a compound `IFilters`,
     * or the `ICondition` interface both implement — into a {@link Predicate}.
     * Dispatch happens in `planCondition` (by node kind), so the concrete
     * union is unnecessary here; callers holding a condition abstractly
     * (schema `default`, builder output, lowered residuals) need no cast.
     */
    compile(expr: ICondition) : Predicate {
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
