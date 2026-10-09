/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '../../../errors';
import { IRValueTable, toIR } from '../../../ir';
import { callBinding } from '../../../native';
import type { ICondition } from '../condition';
import { ITSELF } from '../constants';
import { decodePlan } from './serialize';
import type {
    ConditionPlan,
    IPlanInterpreter,
    PlanConditionOptions,
} from './types';

/**
 * Lower a built-in condition tree into a {@link ConditionPlan} with every
 * semantic policy decision already made: negation twins resolved to
 * `negated` leaf flags, null equality turned into null checks, in/nin
 * decomposed (empty list, null members), the case-fold policy verdict
 * computed, anchored operators derived into positive patterns, value
 * shapes validated and ITSELF placement checked.
 *
 * The lowering runs in the Rust core (`rapiq-core`, `plan.rs`); values
 * cross by reference, so the plan carries the caller's own value objects.
 * Backends interpret the plan via {@link interpretPlan}: they render or
 * compile primitives, they never re-derive operator semantics.
 *
 * Returns `null` when the tree is empty (an empty compound vanishes).
 */
export function planCondition(
    input: ICondition,
    options: PlanConditionOptions = {},
) : ConditionPlan | null {
    const table = new IRValueTable({ objects: 'reference' });
    const condition = JSON.stringify(toIR(input, table));
    const serializedOptions = options.caseSensitive === undefined ?
        undefined :
        JSON.stringify({ caseSensitive: options.caseSensitive });

    const plan = callBinding<unknown>(
        (binding) => binding.planCondition(condition, serializedOptions),
    );

    return decodePlan(plan, table);
}

/**
 * Dispatch a plan node to the matching interpreter handler.
 *
 * The single support-enforcement point: a missing optional handler
 * (`mod`/`size`/`elemMatch`) and an ITSELF leaf without the
 * `itself` declaration throw the typed feature error here — never
 * inside a backend.
 */
export function interpretPlan<R>(
    plan: ConditionPlan,
    interpreter: IPlanInterpreter<R>,
) : R {
    if (
        'field' in plan &&
        plan.field === ITSELF &&
        !interpreter.itself
    ) {
        throw AdapterError.featureUnsupported('filters:itself');
    }

    switch (plan.kind) {
        case 'compound': {
            return interpreter.compound(plan);
        }
        case 'constant': {
            return interpreter.constant(plan);
        }
        case 'null-check': {
            return interpreter.nullCheck(plan);
        }
        case 'compare': {
            return interpreter.compare(plan);
        }
        case 'one-of': {
            return interpreter.oneOf(plan);
        }
        case 'match': {
            return interpreter.match(plan);
        }
        case 'mod': {
            if (!interpreter.mod) {
                throw AdapterError.featureUnsupported('filters:mod');
            }

            return interpreter.mod(plan);
        }
        case 'size': {
            if (!interpreter.size) {
                throw AdapterError.featureUnsupported('filters:size');
            }

            return interpreter.size(plan);
        }
        case 'elem-match': {
            if (!interpreter.elemMatch) {
                throw AdapterError.featureUnsupported('filters:elemMatch');
            }

            return interpreter.elemMatch(plan);
        }
        default: {
            throw AdapterError.featureUnsupported(
                `filters:${(plan as { kind: string }).kind}`,
            );
        }
    }
}
