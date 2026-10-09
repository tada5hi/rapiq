/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    CONDITION_MARKER,
    FilterCompoundOperator,
    Filters,
    and,
    checkConditionIndexed,
    checkSortKeysIndexed,
    eq,
    gte,
    lte,
    not,
    or,
    preserve,
} from '../../../src';
import type { ICondition, IndexesResolver } from '../../../src';

const resolve : IndexesResolver = (path) => {
    if (path === '') {
        return [['realm_id', 'created_at'], ['email']];
    }

    if (path === 'items') {
        return [['user_id']];
    }

    return null;
};

const custom = {
    [CONDITION_MARKER]: true,
    operator: 'geo',
    value: {},
} as unknown as ICondition;

describe('src/schema/indexes/module.ts', () => {
    describe('checkConditionIndexed (anchor)', () => {
        it.each([
            ['leading leaf', eq('realm_id', 'x'), true],
            ['second column only', eq('created_at', 'x'), false],
            ['unindexed leaf', eq('flag', true), false],
            ['anchored AND with residual', and(eq('realm_id', 'x'), eq('flag', true)), true],
            ['unanchored AND', and(eq('created_at', 'x'), eq('flag', true)), false],
            ['OR of anchors', or(eq('realm_id', 'x'), eq('email', 'y')), true],
            ['OR with scan branch', or(eq('realm_id', 'x'), eq('flag', true)), false],
            ['compound conjunct anchors', and(eq('flag', true), or(eq('realm_id', 'x'), eq('email', 'y'))), true],
            // settled anchor rule: one anchored conjunct suffices; a
            // compound conjunct that could not stand alone is residual.
            ['anchored AND with residual compound', and(eq('realm_id', 'x'), or(eq('flag', true), eq('flag', false))), true],
            ['anchored AND with residual negation', and(eq('realm_id', 'x'), not(eq('flag', true))), true],
            ['negation checks its interior', not(eq('realm_id', 'x')), true],
            ['negated unindexed leaf', not(eq('flag', true)), false],
            ['relation anchor', eq('items.user_id', 'x'), true],
            ['relation non-anchor', eq('items.name', 'x'), false],
            ['unknown path', eq('realm.name', 'x'), false],
            ['nested same-operator group', and(and(eq('realm_id', 'x'))), true],
            ['preserved interior', and(preserve(eq('realm_id', 'x'))), true],
            ['empty group', new Filters(FilterCompoundOperator.AND, []), true],
            ['custom-only group', and(custom), true],
            ['custom next to unindexed leaf', and(custom, eq('flag', true)), false],
            ['custom OR branch is skipped', or(custom, eq('realm_id', 'x')), true],
        ])('%s', (_, condition, ok) => {
            expect(checkConditionIndexed(condition, resolve, 'anchor').ok).toBe(ok);
        });
    });

    describe('checkConditionIndexed (cover)', () => {
        it.each([
            ['exact prefix set, any order', and(eq('created_at', 'x'), eq('realm_id', 'y')), true],
            ['single leading column', eq('realm_id', 'x'), true],
            ['residual key rejected', and(eq('realm_id', 'x'), eq('flag', true)), false],
            ['spanning two indexes rejected', and(eq('realm_id', 'x'), eq('email', 'y')), false],
            ['duplicate fields collapse', and(gte('created_at', 'a'), lte('created_at', 'b'), eq('realm_id', 'x')), true],
            ['per-path groups cover separately', and(eq('realm_id', 'x'), eq('items.user_id', 'y')), true],
            ['preserved compound pools into the group', and(eq('realm_id', 'x'), preserve(and(eq('created_at', 'y')))), true],
            ['uncovered relation group', and(eq('realm_id', 'x'), eq('items.name', 'y')), false],
            ['OR branches each covered', or(eq('realm_id', 'x'), eq('email', 'y')), true],
        ])('%s', (_, condition, ok) => {
            expect(checkConditionIndexed(condition, resolve, 'cover').ok).toBe(ok);
        });
    });

    describe('checkSortKeysIndexed', () => {
        it.each([
            ['empty', [], true],
            ['leading column', ['realm_id'], true],
            ['full prefix', ['realm_id', 'created_at'], true],
            ['not a prefix', ['created_at'], false],
            ['wrong order', ['created_at', 'realm_id'], false],
            ['longer than every index', ['realm_id', 'created_at', 'email'], false],
            ['relation path', ['items.user_id'], true],
            ['mixed paths', ['realm_id', 'items.user_id'], false],
            ['unknown path', ['realm.name'], false],
        ])('%s', (_, names, ok) => {
            expect(checkSortKeysIndexed(names, resolve).ok).toBe(ok);
        });
    });

    it('should report the violating path and keys', () => {
        const result = checkConditionIndexed(and(eq('items.name', 'x')), resolve, 'anchor');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.path).toBe('items');
            expect(result.keys).toEqual(['items.name']);
        }
    });

    it('should report a mixed-path violation at the root', () => {
        const result = checkConditionIndexed(
            and(eq('flag', true), eq('items.name', 'x')),
            resolve,
            'anchor',
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.path).toBe('');
            expect(result.keys).toEqual(['flag', 'items.name']);
        }
    });
});
