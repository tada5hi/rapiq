/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '../../../errors';
import { FILTER_OPERATOR_SEMANTICS } from './constants';
import type {
    ComparePlan,
    ConditionPlan,
    PlanCompareOperator,
} from './types';

/**
 * The ordering complement, derived from the semantics table: the
 * operator accepting exactly the complementary three-way comparison
 * range (lt {-1..-1} complements gte {0..1}, and so on). Derived
 * rather than hardcoded, so the table stays the single authority.
 */
const ORDERING_COMPLEMENTS : Partial<Record<PlanCompareOperator, PlanCompareOperator>> = {};

{
    const entries = Object.entries(FILTER_OPERATOR_SEMANTICS)
        .filter((entry) => entry[1].family === 'ordering') as [
        PlanCompareOperator,
        { compare: { min: number, max: number } },
    ][];

    for (const [name, semantics] of entries) {
        const match = entries.find(([, other]) => (
            other.compare.min === (semantics.compare.max === 1 ? -1 : semantics.compare.max + 1) &&
            other.compare.max === (semantics.compare.min === -1 ? 1 : semantics.compare.min - 1)
        ));

        if (match) {
            ORDERING_COMPLEMENTS[name] = match[0];
        }
    }
}

/**
 * Push group negation down to the leaves, eliminating
 * `CompoundPlan.negated` from the tree.
 *
 * `planCondition` keeps group negation because SQL and the in-memory
 * backend render it two-valued cheaply (a CASE wrapper, a `!`).
 * Backends without a two-valued NOT of their own (prisma, and the
 * other structured-args ORMs of plan 023) instead consume this
 * transform. It is semantics-preserving under the settled negation
 * contract:
 *
 * - group negation is the two-valued complement PER BINDING, with the
 *   binding quantifier outermost (SQL applies its CASE wrapper per
 *   join row; the in-memory backend negates per binding context):
 *   so De Morgan applies, negation commutes through `elemMatch`
 *   (`not(elemMatch(c))` selects bindings where an element fails `c`,
 *   NOT records without a matching element), and leaves flip to their
 *   null-inclusive complement twins.
 * - the complement of an ordering comparison has no leaf twin; it
 *   becomes the complementary operator OR a null check: expressible
 *   in the existing plan vocabulary, so backends need no new node
 *   kinds and their usual constant folding (e.g. a non-nullable
 *   column) applies unchanged.
 * - `mod` and `size` have no complement form and stay wrapped in a
 *   residual negated single-child compound; a backend that cannot
 *   render that keeps failing typed, exactly as before.
 */
export function distributeNegation(plan: ConditionPlan) : ConditionPlan {
    return distribute(plan, false);
}

function distribute(plan: ConditionPlan, negated: boolean) : ConditionPlan {
    switch (plan.kind) {
        case 'compound': {
            const effective = negated !== plan.negated;

            const children = plan.children.map((child) => distribute(child, effective));

            // a single-child group carries no operator of its own;
            // unwrapping keeps the tree in the shape the lowering
            // produces for positive input.
            if (children.length === 1) {
                return children[0] as ConditionPlan;
            }

            let { operator } = plan;
            if (effective) {
                operator = plan.operator === 'and' ? 'or' : 'and';
            }

            return {
                kind: 'compound',
                operator,
                negated: false,
                children,
            };
        }
        case 'constant': {
            return negated ? { ...plan, verdict: !plan.verdict } : plan;
        }
        case 'null-check':
        case 'one-of':
        case 'match': {
            return negated ? { ...plan, negated: !plan.negated } : plan;
        }
        case 'compare': {
            return distributeCompare(plan, negated);
        }
        case 'elem-match': {
            // negation commutes through the element quantifier: it
            // applies per binding, the ∃ stays outside.
            return {
                ...plan,
                condition: distribute(plan.condition, negated),
            };
        }
        case 'mod':
        case 'size': {
            if (!negated) {
                return plan;
            }

            // no complement form exists; the residual wrapper keeps
            // the negation explicit for backends that can render it.
            return {
                kind: 'compound',
                operator: 'and',
                negated: true,
                children: [plan],
            };
        }
        default: {
            throw AdapterError.featureUnsupported(
                `filters:${(plan as { kind: string }).kind}`,
            );
        }
    }
}

function distributeCompare(plan: ComparePlan, negated: boolean) : ConditionPlan {
    if (!negated) {
        return plan;
    }

    if (plan.op === 'eq') {
        return { ...plan, negated: !plan.negated };
    }

    const complement = ORDERING_COMPLEMENTS[plan.op];
    if (!complement) {
        throw AdapterError.operatorUnsupported(plan.op);
    }

    // the null-inclusive complement of an ordering comparison: the
    // complementary operator, or no value at all.
    return {
        kind: 'compound',
        operator: 'or',
        negated: false,
        children: [
            { ...plan, op: complement },
            {
                kind: 'null-check',
                field: plan.field,
                negated: false,
                elementwise: true,
            },
        ],
    };
}
