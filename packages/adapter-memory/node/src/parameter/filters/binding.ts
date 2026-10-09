/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ITSELF } from '@rapiq/core';
import { resolveProperty } from '../../helpers';
import type { Predicate } from '../../types';
import { BINDING_ELEMENT_FLAG, BINDING_SCOPE_SEPARATOR } from './constants';
import type { BindingContext, ConditionEval } from './types';

const EMPTY_CONTEXT : BindingContext = new Map();

/**
 * The source value a binding-path segment reads off its parent
 * binding. elemMatch segments carry a scope discriminator that is
 * stripped before property resolution; an ITSELF segment (an
 * elemMatch on the element itself) re-reads the parent binding.
 */
function bindingSource(parent: unknown, segment: string) : unknown {
    const separatorIndex = segment.indexOf(BINDING_SCOPE_SEPARATOR);
    const name = separatorIndex === -1 ?
        segment :
        segment.slice(0, separatorIndex);

    if (name === ITSELF) {
        return parent;
    }

    return resolveProperty(parent, name);
}

/**
 * The join-row candidates a binding path contributes: every element
 * of an array, the object itself, or a single NULL row when the
 * value is absent or the array is empty.
 */
function bindingCandidates(raw: unknown) : unknown[] {
    if (Array.isArray(raw)) {
        return raw.length > 0 ? raw : [null];
    }

    return [raw];
}

/**
 * Quantify a compiled condition tree over all assignments of
 * elements to binding paths (LEFT-join row semantics): the input
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

            const raw = bindingSource(parent, segment);

            // ITSELF leaves only match real array elements — never a
            // to-one object, a scalar or the NULL row.
            ctx.set(`${path}${BINDING_ELEMENT_FLAG}`, Array.isArray(raw) && raw.length > 0);

            const candidates = bindingCandidates(raw);
            for (const candidate of candidates) {
                ctx.set(path, candidate);

                if (enumerate(index + 1)) {
                    return true;
                }
            }

            ctx.delete(path);
            ctx.delete(`${path}${BINDING_ELEMENT_FLAG}`);

            return false;
        };

        return enumerate(0);
    };
}
