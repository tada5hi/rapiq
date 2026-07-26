/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, ConditionPlan } from '../../../src';
import {
    and,
    distributeNegation,
    elemMatch,
    eq,
    exists,
    gte,
    inArray,
    lt,
    mod,
    ne,
    not,
    or,
    planCondition,
} from '../../../src';

function distributed(condition: Condition) : ConditionPlan {
    const plan = planCondition(condition);
    expect(plan).not.toBeNull();

    return distributeNegation(plan as ConditionPlan);
}

/**
 * No compound in the tree carries group negation, except the residual
 * wrappers around kinds without a complement form.
 */
function assertDistributed(plan: ConditionPlan) {
    if (plan.kind === 'compound') {
        if (plan.negated) {
            expect(plan.children).toHaveLength(1);
            expect(['mod', 'size']).toContain((plan.children[0] as ConditionPlan).kind);

            return;
        }

        for (const child of plan.children) {
            assertDistributed(child);
        }
    }

    if (plan.kind === 'elem-match') {
        assertDistributed(plan.condition);
    }
}

describe('src/parameter/filters/plan/distribute.ts', () => {
    it('should leave a positive tree untouched', () => {
        const plan = distributed(and(eq('a', 1), or(gte('b', 2), exists('c'))));

        assertDistributed(plan);
        expect(plan).toEqual(planCondition(and(eq('a', 1), or(gte('b', 2), exists('c')))));
    });

    it('should apply De Morgan to a negated group', () => {
        const plan = distributed(not(and(eq('a', 1), eq('b', 2))));

        expect(plan).toMatchObject({
            kind: 'compound',
            operator: 'or',
            negated: false,
            children: [
                {
                    kind: 'compare', 
                    op: 'eq', 
                    field: 'a', 
                    negated: true,
                },
                {
                    kind: 'compare', 
                    op: 'eq', 
                    field: 'b', 
                    negated: true,
                },
            ],
        });
    });

    it('should toggle the negated flag of leaf twins', () => {
        // ¬(¬a ∨ b) = a ∧ ¬b
        const plan = distributed(not(or(ne('a', 1), inArray('b', [1, 2]))));

        expect(plan).toMatchObject({
            operator: 'and',
            children: [
                { kind: 'compare', negated: false },
                { kind: 'one-of', negated: true },
            ],
        });
    });

    it('should complement an ordering comparison with the dual operator or null', () => {
        const plan = distributed(not(lt('age', 18)));

        expect(plan).toMatchObject({
            kind: 'compound',
            operator: 'or',
            children: [
                {
                    kind: 'compare', 
                    op: 'gte', 
                    value: 18, 
                    negated: false,
                },
                {
                    kind: 'null-check', 
                    field: 'age', 
                    negated: false, 
                },
            ],
        });
    });

    it('should push negation through elemMatch per binding', () => {
        // the settled contract: group negation applies per binding with
        // the quantifier outermost, so ¬elemMatch(c) selects bindings
        // where an element fails c.
        const plan = distributed(not(elemMatch('items', and(eq('a', 1), eq('b', 2)))));

        expect(plan).toMatchObject({
            kind: 'elem-match',
            field: 'items',
            condition: {
                kind: 'compound',
                operator: 'or',
                negated: false,
                children: [
                    { kind: 'compare', negated: true },
                    { kind: 'compare', negated: true },
                ],
            },
        });
    });

    it('should keep a residual wrapper around kinds without a complement', () => {
        const plan = distributed(not(mod('age', 2, 0)));

        expect(plan).toMatchObject({
            kind: 'compound',
            negated: true,
            children: [{ kind: 'mod' }],
        });
    });

    it('should cancel a double negation', () => {
        const plan = distributed(not(not(and(eq('a', 1), gte('b', 2)))));

        assertDistributed(plan);
        expect(plan).toEqual(planCondition(and(eq('a', 1), gte('b', 2))));
    });

    it('should flip a constant verdict', () => {
        // in([]) lowers to a false constant; the negated group flips it.
        expect(distributed(not(and(inArray('a', []))))).toEqual({
            kind: 'constant',
            verdict: true,
        });
    });
});
