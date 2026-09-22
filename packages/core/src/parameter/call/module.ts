/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IAggregate } from '../aggregates';
import type { IGroup } from '../groups';

function isListEqual(a: readonly string[], b: readonly string[]) : boolean {
    return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Name, params (ordered) and lowering (fn, field, args) all equal.
 * An unresolved call (lowering undefined) only equals another unresolved one.
 */
export function isCallEqual(a: IGroup | IAggregate, b: IGroup | IAggregate) : boolean {
    if (a.name !== b.name || !isListEqual(a.params, b.params)) {
        return false;
    }

    if (!a.lowering || !b.lowering) {
        return a.lowering === b.lowering;
    }

    return a.lowering.fn === b.lowering.fn &&
        a.lowering.field === b.lowering.field &&
        isListEqual(a.lowering.args, b.lowering.args);
}
