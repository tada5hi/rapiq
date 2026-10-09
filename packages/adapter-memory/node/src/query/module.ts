/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ApplyOutput,
    Comparator,
    Predicate,
    Projector,
    Slicer,
} from '../types';
import type { CompiledQueryContext } from './types';

export class CompiledQuery<T = Record<string, any>> {
    public readonly predicate : Predicate;

    public readonly comparator : Comparator<T> | undefined;

    public readonly projector : Projector<T> | undefined;

    public readonly pagination : { limit?: number, offset?: number };

    protected slicer : Slicer;

    constructor(ctx: CompiledQueryContext<T>) {
        this.predicate = ctx.predicate;
        this.comparator = ctx.comparator;
        this.projector = ctx.projector;
        this.slicer = ctx.slicer;
        this.pagination = ctx.pagination;
    }

    /**
     * Evaluate the filters parameter against a single input.
     */
    matches(input: unknown) : boolean {
        return this.predicate(input);
    }

    /**
     * Apply the whole query to a collection:
     * filter, sort, paginate, project. The input array
     * is never mutated.
     */
    apply(data: T[]) : ApplyOutput<T> {
        let output = data.filter((item) => this.predicate(item));

        const total = output.length;

        if (this.comparator) {
            output.sort(this.comparator);
        }

        output = this.slicer(output);

        if (this.projector) {
            output = output.map(this.projector);
        }

        return {
            data: output,
            total,
            pagination: { ...this.pagination },
        };
    }
}
