/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRValueTable } from '../../../ir';
import type { ConditionPlan } from './types';

/**
 * Replace the values of a plan with their IR encoding (host references for
 * anything JSON cannot carry), for a plan crossing into the Rust core.
 */
export function encodePlan(plan: ConditionPlan, table: IRValueTable) : unknown {
    switch (plan.kind) {
        case 'compound': {
            return { ...plan, children: plan.children.map((child) => encodePlan(child, table)) };
        }
        case 'compare': {
            return { ...plan, value: table.encode(plan.value) };
        }
        case 'one-of': {
            return { ...plan, values: plan.values.map((value) => table.encode(value)) };
        }
        case 'elem-match': {
            return { ...plan, condition: encodePlan(plan.condition, table) };
        }
        default: {
            return plan;
        }
    }
}

/**
 * Swap the original values back into a plan returned by the Rust core.
 * Only value positions are decoded; the rest of the plan is plain data.
 */
export function decodePlan(input: unknown, table: IRValueTable) : ConditionPlan | null {
    if (input === null || input === undefined) {
        return null;
    }

    const plan = input as ConditionPlan;
    switch (plan.kind) {
        case 'compound': {
            return {
                ...plan,
                children: plan.children.map((child) => decodePlan(child, table) as ConditionPlan),
            };
        }
        case 'compare': {
            return { ...plan, value: table.decode(plan.value) };
        }
        case 'one-of': {
            return { ...plan, values: plan.values.map((value) => table.decode(value)) };
        }
        case 'elem-match': {
            return { ...plan, condition: decodePlan(plan.condition, table) as ConditionPlan };
        }
        default: {
            return plan;
        }
    }
}
