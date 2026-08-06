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
     * Compile a built-in leaf or group held through {@link ICondition} into a
     * {@link Predicate}. Dispatch happens in `planCondition`, so callers holding
     * built-in output abstractly need no cast. A custom condition needs a
     * consumer that understands its semantics.
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
