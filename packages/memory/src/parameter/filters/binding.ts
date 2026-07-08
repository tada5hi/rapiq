/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { resolveProperty } from '../../helpers';
import type { Predicate } from '../../types';
import type { BindingContext, ConditionEval } from './types';

const EMPTY_CONTEXT : BindingContext = new Map();

/**
 * The join-row candidates a relation path segment contributes:
 * every element of an array, the object itself, or a single
 * NULL row when the value is absent or the array is empty.
 */
function bindingCandidates(parent: unknown, segment: string) : unknown[] {
    const raw = resolveProperty(parent, segment);

    if (Array.isArray(raw)) {
        return raw.length > 0 ? raw : [null];
    }

    return [raw];
}

/**
 * Quantify a compiled condition tree over all assignments of
 * elements to relation paths (LEFT-join row semantics): the input
 * matches if some assignment satisfies the whole tree.
 */
export function createBoundPredicate(
    evaluate: ConditionEval,
    paths: Set<string>,
) : Predicate {
    if (paths.size === 0) {
        return (input) => evaluate(EMPTY_CONTEXT, input);
    }

    // lexicographic order puts every path after its prefix,
    // so parent bindings exist before child candidates are built.
    const ordered = [...paths].sort();

    return (input) => {
        const ctx : BindingContext = new Map();

        const enumerate = (index: number) : boolean => {
            if (index === ordered.length) {
                return evaluate(ctx, input);
            }

            const path = ordered[index] as string;
            const separatorIndex = path.lastIndexOf('.');
            const parent = separatorIndex === -1 ?
                input :
                ctx.get(path.slice(0, separatorIndex));
            const segment = separatorIndex === -1 ?
                path :
                path.slice(separatorIndex + 1);

            const candidates = bindingCandidates(parent, segment);
            for (const candidate of candidates) {
                ctx.set(path, candidate);

                if (enumerate(index + 1)) {
                    return true;
                }
            }

            ctx.delete(path);

            return false;
        };

        return enumerate(0);
    };
}
