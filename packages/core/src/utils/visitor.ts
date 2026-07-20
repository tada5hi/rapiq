/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from './object';

/**
 * Check whether the input is an AST node dispatching to the given
 * visitor method. Every node's accept() performs double dispatch to
 * exactly one visit* method, so the dispatch target identifies the
 * node kind — reliably across package instances (where instanceof
 * fails) and for structurally identical nodes (e.g. Fields & Sorts),
 * which member checks cannot tell apart.
 */
export function dispatchesTo<VISITOR>(
    input: unknown,
    method: keyof VISITOR & string,
) : boolean {
    if (
        !isObject(input) ||
        typeof input.accept !== 'function'
    ) {
        return false;
    }

    let output = false;

    const visitor = {
        [method]: () => {
            output = true;
        },
    };

    try {
        input.accept(visitor);
    } catch {
        // a foreign node dispatches to a visit* method
        // the probe visitor does not implement.
    }

    return output;
}
