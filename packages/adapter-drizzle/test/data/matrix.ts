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
    gte,
    inArray,
    lt,
    ne,
    nin,
    not,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    startsWith,
} from '@rapiq/core';
import type { User } from './type';

/**
 * The shared parity matrix, replayed by the sqlite engine (default
 * suite) and by postgres (`test:db`). Complement pairs partition the
 * fixture records; every row is also checked against
 * `@rapiq/adapter-memory`.
 *
 * The values here are case-exact on purpose: sqlite has no `ilike`,
 * so the case-insensitive equality default only holds on postgres and
 * is measured by {@link casePairs} there.
 */
export const complementPairs : [string, Condition, Condition][] = [
    ['eq/ne', eq('address', 'Hogwarts'), ne('address', 'Hogwarts')],
    ['eq/ne (null)', eq('address', null), ne('address', null)],
    ['in/nin', inArray('address', ['Hogwarts', 'Mordor']), nin('address', ['Hogwarts', 'Mordor'])],
    ['in/nin (null member)', inArray('address', ['Hogwarts', null]), nin('address', ['Hogwarts', null])],
    ['in/nin (empty)', inArray('address', []), nin('address', [])],
    ['contains/notContains', contains('address', 'wart'), notContains('address', 'wart')],
    ['startsWith/notStartsWith', startsWith('address', 'Hog'), notStartsWith('address', 'Hog')],
    ['endsWith/notEndsWith', endsWith('address', 'arts'), notEndsWith('address', 'arts')],
    ['exists true/false', exists('address'), exists('address', false)],
    ['eq/ne (to-one relation)', eq('realm.name', 'master'), ne('realm.name', 'master')],
    ['eq/ne (to-one presence)', exists('realm'), exists('realm', false)],
];

// De Morgan push-down has to hold for whole trees, not just leaves.
export const compounds : [string, Condition][] = [
    ['not(and)', not(and(eq('address', 'Hogwarts'), gte('age', 18)))],
    ['not(or)', not(or(eq('address', 'Hogwarts'), eq('address', 'Mordor')))],
    ['not(not(and))', not(not(and(eq('address', 'Hogwarts'), gte('age', 18))))],
    ['nested', not(or(and(eq('address', 'Mordor'), lt('age', 40)), exists('address', false)))],
    ['relation inside a negated group', not(and(eq('realm.name', 'master'), gte('age', 18)))],
];

/**
 * A to-many path binds per element (per left-joined row), so a record
 * with a matching *and* a non-matching element satisfies both a
 * condition and its negation; the pair does not partition the records
 * and only agreement with the reference backend is asserted.
 */
export const collections : [string, Condition][] = [
    ['eq', eq('items.title', 'book')],
    ['ne', ne('items.title', 'book')],
    ['not(eq)', not(eq('items.title', 'book'))],
    ['eq (null column)', eq('items.color', null)],
    ['ne (null column)', ne('items.color', null)],
    ['exists', exists('items.color')],
    ['exists false', exists('items.color', false)],
    ['in', inArray('items.color', ['red', null])],
    ['nin', nin('items.color', ['red', null])],
    ['contains', contains('items.title', 'oo')],
    ['notContains', notContains('items.title', 'oo')],
    ['elemMatch', elemMatch('items', and(eq('title', 'book'), eq('color', 'red')))],
    ['not(elemMatch)', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],
];

/**
 * Same-element binding: sibling conditions on one to-many path bind
 * to the SAME element on every backend; the split record satisfies
 * each condition on a DIFFERENT element and must not match.
 */
export const sameElement : [string, Condition][] = [
    ['and on one path', and(eq('items.title', 'book'), eq('items.color', 'red'))],
    ['or on one path', or(eq('items.title', 'ring'), eq('items.color', 'blue'))],
    ['negated leaf in the group', and(ne('items.title', 'ring'), eq('items.color', 'red'))],
    ['mixed root and relation', and(eq('items.title', 'book'), or(eq('items.color', 'red'), eq('id', 9)))],
    ['negated group over one path', not(and(eq('items.title', 'book'), eq('items.color', 'red')))],
    ['not(elemMatch) with a mixed record', not(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))],
];

// -----------------------------------------------------------

/**
 * Case-variant twins of record 1's `first_name`, plus literal LIKE
 * wildcard values: only postgres can express the case-insensitive
 * equality default (`ilike`) and the adapter-escaped operand.
 */
export const caseRecords : User[] = [
    {
        id: 7,
        first_name: 'caleb',
        last_name: 'Lower',
        email: 'caleb.lower@case.io',
        age: 5,
        address: '50%',
        realm_id: null,
        realm: null,
        items: [],
    },
    {
        id: 8,
        first_name: 'CALEB',
        last_name: 'Upper',
        email: 'caleb.upper@case.io',
        age: 6,
        address: '50x',
        realm_id: null,
        realm: null,
        items: [],
    },
];

/**
 * The case contract (postgres only): the equality family folds by
 * default, and a lowered `ilike` operand is escaped, so a literal
 * `%`/`_` never widens the match.
 */
export const casePairs : [string, Condition, Condition][] = [
    ['eq/ne (case fold)', eq('first_name', 'Caleb'), ne('first_name', 'Caleb')],
    ['in/nin (case fold)', inArray('first_name', ['caleb', 'FRODO']), nin('first_name', ['caleb', 'FRODO'])],
    ['contains/notContains (case fold)', contains('address', 'WART'), notContains('address', 'WART')],
    ['eq/ne (literal wildcard)', eq('address', '50%'), ne('address', '50%')],
    ['startsWith/notStartsWith (escaped)', startsWith('address', '50%'), notStartsWith('address', '50%')],
];
