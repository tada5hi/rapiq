/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    CONDITION_MARKER,
    Filter,
    FilterCompoundOperator,
    Filters,
    and,
    eq,
    findRequiredEqualValue,
    inArray,
    ne,
    not,
    or,
    preserve,
    replaceRequiredEqualValue,
    startsWith,
} from '../../../src';
import type { ICondition, IFilters } from '../../../src';

describe('src/parameter/filters/required.ts', () => {
    describe('findRequiredEqualValue', () => {
        it('should find the value of a root leaf', () => {
            expect(findRequiredEqualValue(eq('postId', 'a'), 'postId')).toBe('a');
        });

        it('should find through nested ANDs', () => {
            const tree = and(eq('x', 1), and(eq('y', 2), and(eq('postId', 'a'))));

            expect(findRequiredEqualValue(tree, 'postId')).toBe('a');
        });

        it('should find nothing under or / not', () => {
            expect(findRequiredEqualValue(or(eq('postId', 'a'), eq('postId', 'b')), 'postId')).toBeUndefined();
            expect(findRequiredEqualValue(not(eq('postId', 'a')), 'postId')).toBeUndefined();
            expect(findRequiredEqualValue(and(or(eq('postId', 'a'))), 'postId')).toBeUndefined();
        });

        it('should ignore other operators and other fields', () => {
            expect(findRequiredEqualValue(ne('postId', 'a'), 'postId')).toBeUndefined();
            expect(findRequiredEqualValue(inArray('postId', ['a']), 'postId')).toBeUndefined();
            expect(findRequiredEqualValue(startsWith('postId', 'a'), 'postId')).toBeUndefined();
            expect(findRequiredEqualValue(eq('other', 'a'), 'postId')).toBeUndefined();
        });

        it('should return the first on conflict', () => {
            expect(findRequiredEqualValue(and(eq('postId', 'a'), eq('postId', 'b')), 'postId')).toBe('a');
        });

        it('should stop at the first leaf even when its value is undefined', () => {
            expect(findRequiredEqualValue(and(eq('postId', undefined), eq('postId', 'a')), 'postId')).toBeUndefined();
        });

        it('should return non-string values', () => {
            expect(findRequiredEqualValue(eq('postId', 5), 'postId')).toBe(5);
            expect(findRequiredEqualValue(eq('postId', null), 'postId')).toBeNull();
        });

        it('should treat a custom condition as opaque', () => {
            const custom: ICondition = {
                [CONDITION_MARKER]: true,
                operator: 'custom',
                value: [eq('postId', 'a')],
            };

            expect(findRequiredEqualValue(custom, 'postId')).toBeUndefined();
        });
    });

    describe('replaceRequiredEqualValue', () => {
        it('should replace a root leaf and keep preserved', () => {
            const out = replaceRequiredEqualValue(preserve(eq('postId', 'a')), 'postId', 'a', 'x');

            expect(out).toBeInstanceOf(Filter);
            expect((out as Filter).value).toBe('x');
            expect(out.preserved).toBe(true);
        });

        it('should rebuild only the changed AND path and share siblings', () => {
            const sibling = eq('y', 2);
            const untouched = and(eq('z', 3));
            const tree = and(eq('postId', 'a'), sibling, untouched);
            const out = replaceRequiredEqualValue(tree, 'postId', 'a', 'x');

            expect(out).not.toBe(tree);
            expect(out).toBeInstanceOf(Filters);
            expect(out.value[0]).toMatchObject({ field: 'postId', value: 'x' });
            expect(out.value[1]).toBe(sibling);
            expect(out.value[2]).toBe(untouched);
        });

        it('should keep preserved on a rebuilt group', () => {
            const tree = preserve(and(eq('postId', 'a')));
            const out = replaceRequiredEqualValue(tree, 'postId', 'a', 'x');

            expect(out).not.toBe(tree);
            expect(out.preserved).toBe(true);
        });

        it('should return the same object when nothing changes', () => {
            const tree = and(eq('postId', 'b'), and(eq('y', 1)), or(eq('postId', 'c')), not(ne('postId', 'a')));

            expect(replaceRequiredEqualValue(tree, 'postId', 'a', 'x')).toBe(tree);

            const leaf = eq('postId', 'b');

            expect(replaceRequiredEqualValue(leaf, 'postId', 'a', 'x')).toBe(leaf);
        });

        it('should only replace leaves equal to from and leave other values as they are', () => {
            const tree = and(eq('postId', 'a'), eq('postId', 'b'));

            expect(findRequiredEqualValue(tree, 'postId')).toBe('a');

            const out = replaceRequiredEqualValue(tree, 'postId', 'a', 'x');

            expect(out.value[0]).toMatchObject({ value: 'x' });
            expect(out.value[1]).toBe(tree.value[1]);
        });

        it('should not keep the input value type in the result', () => {
            const leaf = new Filter<'eq', string>('eq', 'postId', 'slug');
            const group = new Filters<Filter<'eq', string>>('and', [leaf]);

            const outLeaf = replaceRequiredEqualValue(leaf, 'postId', 'slug', 123);
            const outGroup = replaceRequiredEqualValue(group, 'postId', 'slug', 123);

            expectTypeOf(outLeaf.value).toBeUnknown();
            expectTypeOf(outGroup).toEqualTypeOf<IFilters>();
            expect(outLeaf.value).toBe(123);
            expect(outGroup.value[0]).toMatchObject({ value: 123 });
        });

        it('should replace inside or / not groups and keep their operator', () => {
            const sibling = eq('featured', true);
            const o = or(eq('postId', 'a'), sibling);
            const n = not(eq('postId', 'a'));

            const nextOr = replaceRequiredEqualValue(o, 'postId', 'a', 'x');

            expect(nextOr).not.toBe(o);
            expect(nextOr.operator).toEqual(FilterCompoundOperator.OR);
            expect((nextOr.value[0] as Filter).value).toEqual('x');
            expect(nextOr.value[1]).toBe(sibling);

            const nextNot = replaceRequiredEqualValue(n, 'postId', 'a', 'x');

            expect(nextNot.operator).toEqual(FilterCompoundOperator.NOT);
            expect((nextNot.value[0] as Filter).value).toEqual('x');
        });

        it('should rewrite the resolved value in an or branch next to the required leaf', () => {
            const tree = and(
                eq('postId', 'slug'),
                or(eq('postId', 'slug'), eq('featured', true)),
            );

            const next = replaceRequiredEqualValue(tree, 'postId', 'slug', 42);

            expect(findRequiredEqualValue(next, 'postId')).toEqual(42);

            const branch = next.value[1] as Filters;

            expect((branch.value[0] as Filter).value).toEqual(42);
        });

        it('should keep preserved on a rebuilt or group', () => {
            const tree = preserve(or(eq('postId', 'a'), eq('featured', true)));

            expect(replaceRequiredEqualValue(tree, 'postId', 'a', 'x').preserved).toBe(true);
        });

        it('should treat a custom condition as opaque and return it by reference', () => {
            const custom: ICondition = {
                [CONDITION_MARKER]: true,
                operator: 'custom',
                value: [eq('postId', 'a')],
            };

            expect(replaceRequiredEqualValue(custom, 'postId', 'a', 'x')).toBe(custom);

            const tree = and(custom, or(eq('postId', 'b')));

            expect(replaceRequiredEqualValue(tree, 'postId', 'a', 'x')).toBe(tree);
        });

        it('should ignore other operators and compare strictly', () => {
            const a = ne('postId', 'a');
            const b = inArray('postId', ['a']);
            const c = eq('postId', '1');
            const tree = and(a, b, c);

            expect(replaceRequiredEqualValue(tree, 'postId', 'a', 'x')).toBe(tree);
            expect(replaceRequiredEqualValue(tree, 'postId', 1, 'x')).toBe(tree);
        });
    });
});
