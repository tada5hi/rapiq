/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    and,
    contains,
    elemMatch,
    endsWith,
    eq,
    exists,
    gt,
    gte,
    inArray,
    lt,
    lte,
    ne,
    nin,
    not,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    startsWith,
} from '@rapiq/core';

/**
 * The engine parity matrix, replayed by `engine.db.spec.ts` against a
 * real query engine (sqlite by default, postgres under
 * `DB_TYPE=postgres`); the enrollment tripwire holds it against the
 * core semantics table.
 *
 * Case-matched literals throughout: SQLite compares `equals`
 * case-sensitively and has no `mode`, which the engine suite's
 * dedicated case-contract spec measures instead of assuming.
 */
export const parityConditions : [string, Condition][] = [
    ['eq', eq('address', 'Hogwarts')],
    ['ne', ne('address', 'Hogwarts')],
    ['eq (null)', eq('address', null)],
    ['ne (null)', ne('address', null)],
    ['exists', exists('address')],
    ['exists false', exists('address', false)],
    ['in', inArray('address', ['Hogwarts', 'Mordor'])],
    ['nin', nin('address', ['Hogwarts', 'Mordor'])],
    ['in (null member)', inArray('address', ['Hogwarts', null])],
    ['nin (null member)', nin('address', ['Hogwarts', null])],
    ['in (empty)', inArray('address', [])],
    ['nin (empty)', nin('address', [])],
    ['gte', gte('age', 33)],
    ['not(gte)', not(gte('age', 33))],
    ['gt', gt('age', 18)],
    ['not(gt)', not(gt('age', 18))],
    ['lt', lt('age', 33)],
    ['not(lt)', not(lt('age', 33))],
    ['lte', lte('age', 33)],
    ['not(lte)', not(lte('age', 33))],
    ['contains', contains('address', 'ord')],
    ['notContains', notContains('address', 'ord')],
    ['startsWith', startsWith('address', 'Hog')],
    ['notStartsWith', notStartsWith('address', 'Hog')],
    ['endsWith', endsWith('address', 'arts')],
    ['notEndsWith', notEndsWith('address', 'arts')],

    ['to-one eq', eq('realm.name', 'master')],
    ['to-one ne', ne('realm.name', 'master')],
    ['to-one null column', eq('realm.description', null)],
    ['to-one null column (negated)', ne('realm.description', null)],
    ['to-one relation exists', exists('realm')],
    ['to-one relation absent', exists('realm', false)],

    ['to-many eq', eq('items.title', 'book')],
    ['to-many ne', ne('items.title', 'book')],
    ['to-many not(eq)', not(eq('items.title', 'book'))],
    ['to-many null column', eq('items.color', null)],
    ['to-many null column (negated)', ne('items.color', null)],
    ['to-many in', inArray('items.color', ['red', null])],
    ['to-many nin', nin('items.color', ['red', null])],
    ['to-many contains', contains('items.title', 'oo')],
    ['to-many notContains', notContains('items.title', 'oo')],
    ['to-many relation exists', exists('items')],
    ['to-many relation absent', exists('items', false)],

    // a relation-presence leaf under a to-many binds to ONE element,
    // exactly like a column leaf on the same path
    ['nested to-one presence through a to-many', exists('items.realm')],
    ['nested to-one absence through a to-many', exists('items.realm', false)],
    ['presence conjoined with a same-element column', and(eq('items.title', 'book'), exists('items.realm'))],
    ['absence conjoined with a same-element column', and(eq('items.title', 'book'), exists('items.realm', false))],
    ['nested to-one column through a to-many', eq('items.realm.name', 'master')],

    ['same-element and', and(eq('items.title', 'book'), eq('items.color', 'red'))],
    ['same-element or', or(eq('items.title', 'ring'), eq('items.color', 'silver'))],
    ['same-element negated leaf', and(ne('items.title', 'ring'), eq('items.color', 'red'))],
    ['same-element mixed nesting', and(eq('items.title', 'book'), or(eq('items.color', 'red'), gte('age', 21)))],
    ['same-element negated group', not(and(eq('items.title', 'book'), eq('items.color', 'red')))],

    ['elemMatch', elemMatch('items', and(eq('title', 'book'), eq('color', 'red')))],
    ['elemMatch (null interior)', elemMatch('items', eq('color', null))],
    ['not(elemMatch)', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],

    ['not(and)', not(and(eq('address', 'Hogwarts'), gte('age', 18)))],
    ['not(or)', not(or(eq('address', 'Hogwarts'), eq('address', 'Mordor')))],
    ['nested', not(or(and(eq('address', 'Mordor'), lt('age', 40)), exists('address', false)))],
    ['relation in a negated group', not(and(eq('realm.name', 'master'), gte('age', 18)))],
];
