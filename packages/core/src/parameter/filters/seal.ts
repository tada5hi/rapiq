/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from './condition';

/**
 * Mark a condition as non-displaceable (immutable, a sealed copy is
 * returned): a later `merge` never drops it and `flatten` never hoists
 * it out of its group. This is what `Filters.and` / `Filters.or` apply
 * to the conditions they inject; reach for it directly when a
 * server-authored condition — a policy residual returned from a filters
 * `validate` hook, a scoped default — has to survive composition by
 * other code.
 *
 * The seal is a server-side composition marker, not part of any wire
 * grammar: a sealed condition that is encoded and decoded again comes
 * back displaceable.
 *
 * Detached runtime data without callable sealing behavior is returned
 * unchanged.
 */
export function seal<T extends ICondition>(condition: T) : T;
export function seal(condition: ICondition) : ICondition {
    if (typeof condition.seal === 'function') {
        return condition.seal();
    }

    return condition;
}
