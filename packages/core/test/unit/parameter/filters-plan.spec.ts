/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    CompoundPlan,
    ConditionPlan,
    IPlanInterpreter,
} from '../../../src';
import {
    AdapterError,
    ErrorCode,
    FILTER_OPERATOR_SEMANTICS,
    Filter,
    FilterFieldOperator,
    Filters,
    ITSELF,
    interpretPlan,
    planCondition,
} from '../../../src';

describe('src/parameter/filters/plan/constants.ts', () => {
    it('should cover every filter operator', () => {
        const operators = Object.values(FilterFieldOperator);
        const covered = Object.keys(FILTER_OPERATOR_SEMANTICS);

        expect(covered.sort()).toEqual([...operators].sort());
    });

    it('should only point complements at positive operators', () => {
        const table = FILTER_OPERATOR_SEMANTICS as Record<
            string, 
            { complementOf?: string }
        >;

        for (const key of Object.keys(table)) {
            const target = table[key].complementOf;
            if (target) {
                expect(table[target]).toBeDefined();
                expect(table[target].complementOf).toBeUndefined();
            }
        }
    });

    it('should classify families consistently', () => {
        const table = FILTER_OPERATOR_SEMANTICS as Record<
            string, 
            {
                family: string, 
                anchor?: unknown, 
                compare?: unknown 
            }
        >;

        for (const key of Object.keys(table)) {
            const entry = table[key];
            expect(!!entry.anchor).toEqual(entry.family === 'anchored');
            expect(!!entry.compare).toEqual(entry.family === 'ordering');
        }
    });

    it('should dispatch through unique visitor methods', () => {
        const methods = Object.values(FILTER_OPERATOR_SEMANTICS)
            .map((entry) => entry.visitorMethod);

        expect(new Set(methods).size).toEqual(methods.length);
    });
});

describe('src/parameter/filters/plan/module.ts', () => {
    describe('equality', () => {
        it('should lower eq on a string with the fold verdict', () => {
            expect(planCondition(new Filter('eq', 'name', 'John'))).toEqual({
                kind: 'compare',
                field: 'name',
                op: 'eq',
                value: 'John',
                caseFold: true,
                negated: false,
            });
        });

        it('should keep non-string equality typed and exact', () => {
            expect(planCondition(new Filter('eq', 'age', 18))).toMatchObject({ kind: 'compare', caseFold: false });
        });

        it('should respect the caseSensitive opt-out list', () => {
            expect(planCondition(
                new Filter('eq', 'name', 'John'),
                { caseSensitive: ['name'] },
            )).toMatchObject({ caseFold: false });

            expect(planCondition(
                new Filter('eq', 'name', 'John'),
                { caseSensitive: true },
            )).toMatchObject({ caseFold: false });
        });

        it('should lower null equality to a null check', () => {
            expect(planCondition(new Filter('eq', 'age', null))).toEqual({
                kind: 'null-check', 
                field: 'age', 
                negated: false, 
                elementwise: true,
            });

            expect(planCondition(new Filter('ne', 'age', null))).toEqual({
                kind: 'null-check', 
                field: 'age', 
                negated: true, 
                elementwise: true,
            });

            expect(planCondition(new Filter('eq', 'age', undefined))).toMatchObject({ kind: 'null-check' });
        });

        it('should mark ne as negated', () => {
            expect(planCondition(new Filter('ne', 'name', 'John'))).toMatchObject({
                kind: 'compare', 
                op: 'eq', 
                negated: true, 
                caseFold: true,
            });
        });
    });

    describe('ordering', () => {
        it('should lower ordering operators without folding', () => {
            expect(planCondition(new Filter('gte', 'age', 18))).toEqual({
                kind: 'compare',
                field: 'age',
                op: 'gte',
                value: 18,
                caseFold: false,
                negated: false,
            });
        });
    });

    describe('membership', () => {
        it('should fold an empty list to a constant', () => {
            expect(planCondition(new Filter('in', 'age', []))).toEqual({ kind: 'constant', verdict: false });

            expect(planCondition(new Filter('nin', 'age', []))).toEqual({ kind: 'constant', verdict: true });
        });

        it('should fold a non-array value to a constant', () => {
            expect(planCondition(new Filter('in', 'age', 5 as never))).toEqual({ kind: 'constant', verdict: false });
        });

        it('should lower an all-null list to a null check', () => {
            expect(planCondition(new Filter('in', 'age', [null]))).toEqual({
                kind: 'null-check', 
                field: 'age', 
                negated: false, 
                elementwise: true,
            });

            expect(planCondition(new Filter('nin', 'age', [null, undefined]))).toEqual({
                kind: 'null-check', 
                field: 'age', 
                negated: true, 
                elementwise: true,
            });
        });

        it('should extract null members', () => {
            expect(planCondition(new Filter('in', 'age', [18, null, 21]))).toEqual({
                kind: 'one-of',
                field: 'age',
                values: [18, 21],
                includesNull: true,
                caseFold: true,
                negated: false,
            });
        });

        it('should keep a null-free list intact', () => {
            expect(planCondition(new Filter('nin', 'status', ['a', 'b']))).toEqual({
                kind: 'one-of',
                field: 'status',
                values: ['a', 'b'],
                includesNull: false,
                caseFold: true,
                negated: true,
            });
        });
    });

    describe('anchored', () => {
        it('should derive an escaped, anchored positive pattern', () => {
            expect(planCondition(new Filter('startsWith', 'name', 'Jo.'))).toEqual({
                kind: 'match',
                field: 'name',
                pattern: { mode: 'starts', text: 'Jo.' },
                regexSource: '^Jo\\.',
                ignoreCase: true,
                negated: false,
            });
        });

        it('should never derive a lookahead for negations', () => {
            expect(planCondition(new Filter('notContains', 'name', 'oh'))).toEqual({
                kind: 'match',
                field: 'name',
                pattern: { mode: 'contains', text: 'oh' },
                regexSource: 'oh',
                ignoreCase: true,
                negated: true,
            });
        });

        it('should stringify non-string anchored values', () => {
            expect(planCondition(new Filter('endsWith', 'code', 5))).toMatchObject({
                pattern: { mode: 'ends', text: '5' },
                regexSource: '5$',
            });
        });
    });

    describe('regex', () => {
        it('should strip stateful flags from a RegExp value', () => {
            expect(planCondition(new Filter('regex', 'name', /^jo/gi))).toEqual({
                kind: 'match',
                field: 'name',
                pattern: {
                    mode: 'regex', 
                    source: '^jo', 
                    flags: 'i', 
                },
                regexSource: '^jo',
                ignoreCase: true,
                negated: false,
            });
        });

        it('should pass string patterns through unvalidated', () => {
            expect(planCondition(new Filter('regex', 'name', '[[:alpha:]]+'))).toMatchObject({
                pattern: {
                    mode: 'regex', 
                    source: '[[:alpha:]]+', 
                    flags: '', 
                },
                ignoreCase: false,
            });
        });

        it('should reject non-pattern values typed', () => {
            expect(() => planCondition(new Filter('regex', 'name', 5)))
                .toThrowError(AdapterError);
        });
    });

    describe('existence, arithmetic, cardinality', () => {
        it('should lower exists by truthiness', () => {
            expect(planCondition(new Filter('exists', 'age', true))).toEqual({
                kind: 'null-check', 
                field: 'age', 
                negated: true, 
                elementwise: false,
            });

            expect(planCondition(new Filter('exists', 'age', false))).toMatchObject({ negated: false });
        });

        it('should validate mod values centrally', () => {
            expect(planCondition(new Filter('mod', 'age', [2, 0]))).toEqual({
                kind: 'mod', 
                field: 'age', 
                divisor: 2, 
                remainder: 0,
            });

            expect(planCondition(new Filter('mod', 'age', [0, 1]))).toEqual({ kind: 'constant', verdict: false });

            expect(planCondition(new Filter('mod', 'age', 'x'))).toEqual({ kind: 'constant', verdict: false });
        });

        it('should keep the identity of an invalid size condition', () => {
            expect(planCondition(new Filter('size', 'items', 3))).toEqual({
                kind: 'size', 
                field: 'items', 
                count: 3,
            });

            expect(planCondition(new Filter('size', 'items', -1))).toEqual({
                kind: 'size', 
                field: 'items', 
                count: null,
            });
        });
    });

    describe('elemMatch & ITSELF', () => {
        it('should plan the interior recursively', () => {
            const plan = planCondition(new Filter(
                'elemMatch',
                'items',
                new Filter('eq', 'title', 'a'),
            ));

            expect(plan).toEqual({
                kind: 'elem-match',
                field: 'items',
                condition: {
                    kind: 'compare',
                    field: 'title',
                    op: 'eq',
                    value: 'a',
                    caseFold: true,
                    negated: false,
                },
            });
        });

        it('should match case opt-outs on the composed path', () => {
            const plan = planCondition(
                new Filter('elemMatch', 'items', new Filter('eq', 'title', 'a')),
                { caseSensitive: ['items.title'] },
            );

            expect(plan).toMatchObject({ condition: { caseFold: false } });
        });

        it('should reject a non-condition interior typed', () => {
            expect(() => planCondition(new Filter('elemMatch', 'items', { title: 'a' })))
                .toThrowError(AdapterError);
        });

        it('should vanish with an empty interior', () => {
            expect(planCondition(new Filter(
                'elemMatch',
                'items',
                new Filters('and', []),
            ))).toBeNull();
        });

        it('should allow ITSELF only inside an element scope', () => {
            expect(planCondition(new Filter(
                'elemMatch',
                'scores',
                new Filter('gt', ITSELF, 5),
            ))).toMatchObject({
                kind: 'elem-match',
                condition: { kind: 'compare', field: ITSELF },
            });

            expect(() => planCondition(new Filter('gt', ITSELF, 5)))
                .toThrowError(AdapterError);

            expect(() => planCondition(new Filter('elemMatch', ITSELF, new Filter('gt', ITSELF, 5))))
                .toThrowError(AdapterError);
        });
    });

    describe('compounds', () => {
        it('should lower and/or groups', () => {
            const plan = planCondition(new Filters('or', [
                new Filter('eq', 'age', 12),
                new Filters('and', [
                    new Filter('gt', 'age', 20),
                    new Filter('lt', 'age', 30),
                ]),
            ])) as CompoundPlan;

            expect(plan.kind).toEqual('compound');
            expect(plan.operator).toEqual('or');
            expect(plan.negated).toBeFalsy();
            expect(plan.children).toHaveLength(2);
            expect(plan.children[1]).toMatchObject({ kind: 'compound', operator: 'and' });
        });

        it('should lower nor/not with multiple children to negated groups', () => {
            expect(planCondition(new Filters('nor', [
                new Filter('eq', 'age', 1),
                new Filter('eq', 'age', 2),
            ]))).toMatchObject({ operator: 'or', negated: true });

            expect(planCondition(new Filters('not', [
                new Filter('gt', 'age', 1),
                new Filter('lt', 'age', 9),
            ]))).toMatchObject({ operator: 'and', negated: true });
        });

        it('should normalize a single-child negation onto the leaf plan', () => {
            // not(eq) lowers to the identical plan as ne (complement law).
            expect(planCondition(new Filters('not', [
                new Filter('eq', 'age', 1),
            ]))).toEqual(planCondition(new Filter('ne', 'age', 1)));

            expect(planCondition(new Filters('nor', [
                new Filter('in', 'age', [1, 2]),
            ]))).toEqual(planCondition(new Filter('nin', 'age', [1, 2])));

            expect(planCondition(new Filters('not', [
                new Filter('contains', 'name', 'pe'),
            ]))).toEqual(planCondition(new Filter('notContains', 'name', 'pe')));

            expect(planCondition(new Filters('not', [
                new Filter('exists', 'name', true),
            ]))).toEqual(planCondition(new Filter('exists', 'name', false)));

            // a negated regex has no operator twin — the plan-level
            // negated flag is its only surface.
            expect(planCondition(new Filters('not', [
                new Filter('regex', 'name', 'pe.*'),
            ]))).toMatchObject({ kind: 'match', negated: true });

            // constants flip their verdict: not(in([])) matches everything.
            expect(planCondition(new Filters('not', [
                new Filter('in', 'age', []),
            ]))).toEqual({ kind: 'constant', verdict: true });
        });

        it('should cancel a double negation', () => {
            expect(planCondition(new Filters('not', [
                new Filters('not', [new Filter('gt', 'age', 1)]),
            ]))).toEqual({
                kind: 'compound',
                operator: 'and',
                negated: false,
                children: [planCondition(new Filter('gt', 'age', 1))],
            });
        });

        it('should wrap negations without a negated leaf form in a negated group', () => {
            // ordering complements are null-inclusive — gte is NOT the
            // complement of lt, so no twin normalization applies.
            expect(planCondition(new Filters('not', [
                new Filter('lt', 'age', 5),
            ]))).toEqual({
                kind: 'compound',
                operator: 'and',
                negated: true,
                children: [planCondition(new Filter('lt', 'age', 5))],
            });

            expect(planCondition(new Filters('not', [
                new Filter('mod', 'age', [2, 0]),
            ]))).toMatchObject({
                kind: 'compound',
                negated: true,
                children: [{ kind: 'mod' }],
            });

            expect(planCondition(new Filters('not', [
                new Filter('size', 'items', 2),
            ]))).toMatchObject({
                kind: 'compound',
                negated: true,
                children: [{ kind: 'size' }],
            });

            expect(planCondition(new Filters('not', [
                new Filter('elemMatch', 'items', new Filter('eq', 'id', 1)),
            ]))).toMatchObject({
                kind: 'compound',
                negated: true,
                children: [{ kind: 'elem-match' }],
            });
        });

        it('should vanish empty compounds', () => {
            expect(planCondition(new Filters('and', []))).toBeNull();
            expect(planCondition(new Filters('and', [new Filters('or', [])])))
                .toBeNull();
        });

        it('should reject unknown compound operators typed', () => {
            expect(() => planCondition(new Filters('xor', [new Filter('eq', 'a', 1)])))
                .toThrowError(AdapterError);
        });

        it('should reject unknown leaf operators typed', () => {
            expect(() => planCondition(new Filter('like', 'a', 1)))
                .toThrowError(AdapterError);
        });
    });
});

describe('src/parameter/filters/plan/module.ts interpretPlan', () => {
    const createInterpreter = () : IPlanInterpreter<string> => ({
        compound(plan: CompoundPlan) {
            return `compound(${plan.children
                .map((child) => interpretPlan(child, this))
                .join(', ')})`;
        },
        constant: () => 'constant',
        nullCheck: () => 'null-check',
        compare: () => 'compare',
        oneOf: () => 'one-of',
        match: () => 'match',
    });

    it('should dispatch nodes to their handlers', () => {
        const plan = planCondition(new Filters('and', [
            new Filter('eq', 'a', 1),
            new Filter('contains', 'b', 'x'),
        ])) as ConditionPlan;

        expect(interpretPlan(plan, createInterpreter()))
            .toEqual('compound(compare, match)');
    });

    it('should throw typed on a missing optional handler', () => {
        const size = planCondition(new Filter('size', 'items', 3)) as ConditionPlan;

        expect(() => interpretPlan(size, createInterpreter()))
            .toThrowError(AdapterError);

        try {
            interpretPlan(size, createInterpreter());
        } catch (e) {
            expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
        }
    });

    it('should gate ITSELF on the interpreter declaration', () => {
        const plan = planCondition(new Filter(
            'elemMatch',
            'scores',
            new Filter('gt', ITSELF, 5),
        )) as ConditionPlan;

        const withElemMatch : IPlanInterpreter<string> = {
            ...createInterpreter(),
            elemMatch(input) {
                return interpretPlan(input.condition, this);
            },
        };

        expect(() => interpretPlan(plan, withElemMatch))
            .toThrowError(AdapterError);

        const withItself : IPlanInterpreter<string> = {
            ...withElemMatch,
            itself: true,
        };

        expect(interpretPlan(plan, withItself)).toEqual('compare');
    });
});
