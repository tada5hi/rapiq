/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IRValueTable } from '../../../ir';
import { callBinding } from '../../../native';
import { decodePlan, encodePlan } from './serialize';
import type { ConditionPlan } from './types';

/**
 * Push group negation down to the leaves, eliminating
 * `CompoundPlan.negated` from the tree.
 *
 * `planCondition` keeps group negation because SQL and the in-memory
 * backend render it two-valued cheaply (a CASE wrapper, a `!`).
 * Backends without a two-valued NOT of their own (prisma, drizzle)
 * instead consume this transform. It is semantics-preserving under the
 * settled negation contract: group negation is the two-valued complement
 * PER BINDING with the binding quantifier outermost, so De Morgan applies,
 * negation commutes through `elemMatch`, and leaves flip to their
 * null-inclusive complement twins; the complement of an ordering
 * comparison becomes the complementary operator OR a null check; `mod` and
 * `size` stay wrapped in a residual negated single-child compound.
 *
 * Runs in the Rust core (`rapiq-core`, `plan.rs`).
 */
export function distributeNegation(plan: ConditionPlan) : ConditionPlan {
    const table = new IRValueTable({ objects: 'reference' });
    const encoded = JSON.stringify(encodePlan(plan, table));

    const output = callBinding<unknown>(
        (binding) => binding.distributeNegation(encoded),
    );

    return decodePlan(output, table) as ConditionPlan;
}
