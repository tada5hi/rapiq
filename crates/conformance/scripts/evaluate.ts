/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '@rapiq/core';
import {
    Filter,
    Filters,
    ITSELF,
    and,
    contains,
    elemMatch,
    endsWith,
    eq,
    exists,
    gt,
    gte,
    inArray,
    isBaseError,
    lt,
    lte,
    mod,
    ne,
    nin,
    not,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    regex,
    size,
    startsWith,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';
import type { ConditionIR } from '../src/ir.ts';
import { fromIR, toIR } from '../src/ir.ts';

type Options = { caseSensitive?: boolean | string[] };

type Record = { [key: string]: unknown };

export type EvaluateGroup = {
    name: string,
    filters: ConditionIR,
    options?: Options,
    cases?: { record: Record, expected: boolean }[],
    error?: string,
};

const groups : EvaluateGroup[] = [];

/**
 * A group with hand-written verdicts: `[record, expected]` pairs.
 */
function check(
    name: string,
    condition: ICondition,
    cases: [Record, boolean][],
    options?: Options,
) : void {
    groups.push({
        name,
        filters: toIR(condition),
        ...(options ? { options } : {}),
        cases: cases.map(([record, expected]) => ({ record, expected })),
    });
}

/**
 * A group the compiler must refuse with the given error code.
 */
function refuse(name: string, condition: ICondition, error: string) : void {
    groups.push({
        name, 
        filters: toIR(condition), 
        error, 
    });
}

// -----------------------------------------------------------
// primitives
// -----------------------------------------------------------

check('eq: equal scalars', eq('age', 18), [
    [{ age: 18 }, true],
    [{ age: 19 }, false],
]);
check('eq: strings', eq('name', 'Peter'), [[{ name: 'Peter' }, true]]);
check('eq: no coercion across types', eq('age', '18'), [[{ age: 18 }, false]]);
check('eq: no boolean/number coercion', eq('active', 1), [[{ active: true }, false]]);
check('eq: integral and fractional spellings', eq('age', 18), [[{ age: 18.0 }, true]]);
check('eq: null matches null and missing', eq('age', null), [
    [{ age: null }, true],
    [{}, true],
    [{ age: 18 }, false],
]);
check('eq: objects structurally', eq('meta', { a: 1, b: [2, 3] }), [
    [{ meta: { a: 1, b: [2, 3] } }, true],
    [{ meta: { b: [2, 3], a: 1 } }, true],
    [{ meta: { a: 1, b: [3, 2] } }, false],
    [{ meta: { a: 1 } }, false],
]);
check('eq: object mismatch', eq('meta', { a: 1 }), [[{ meta: { a: 2 } }, false]]);
check('eq: inherited property names', eq('toString', 'x'), [[{}, false]]);

check('ne: complement of eq', ne('age', 18), [
    [{ age: 19 }, true],
    [{ age: 18 }, false],
]);
check('ne: matches null and missing', ne('name', 'Peter'), [
    [{ name: null }, true],
    [{}, true],
]);
check('ne null: is-not-null', ne('age', null), [
    [{ age: null }, false],
    [{}, false],
    [{ age: 18 }, true],
]);

check('lt: numbers', lt('age', 18), [
    [{ age: 17 }, true],
    [{ age: 18 }, false],
    [{ age: null }, false],
    [{}, false],
]);
check('lte: numbers', lte('age', 18), [[{ age: 18 }, true], [{ age: 19 }, false]]);
check('gt: numbers', gt('age', 18), [[{ age: 19 }, true], [{ age: 18 }, false]]);
check('gte: numbers', gte('age', 18), [
    [{ age: 18 }, true],
    [{ age: null }, false],
]);
check('gt: strings', gt('name', 'a'), [[{ name: 'b' }, true], [{ name: 'a' }, false]]);
check('gt: strings by UTF-16 code units', gt('name', '｡'), [
    [{ name: '\u{1F600}' }, false],
    [{ name: '｢' }, true],
]);
check('gt: no comparison across types', gt('age', '17'), [[{ age: 18 }, false]]);
check('lt: no number/boolean comparison', lt('age', true), [[{ age: 0 }, false]]);
check('lt: booleans', lt('active', true), [[{ active: false }, true]]);
check('gt: booleans', gt('active', false), [
    [{ active: true }, true],
    [{ active: false }, false],
]);
check('gt: some array element', gt('scores', 10), [
    [{ scores: [5, 20] }, true],
    [{ scores: [5, 6] }, false],
]);

check('exists: is-not-null', exists('age'), [
    [{ age: 18 }, true],
    [{ age: 0 }, true],
    [{ age: null }, false],
    [{}, false],
]);
check('exists false: is-null', exists('age', false), [
    [{ age: null }, true],
    [{}, true],
    [{ age: 18 }, false],
]);
check('exists: inherited property names', exists('constructor'), [[{}, false]]);
check('exists: an array value exists', exists('tags'), [
    [{ tags: [] }, true],
    [{ tags: ['a'] }, true],
]);
check('exists false: an empty array exists', exists('tags', false), [[{ tags: [] }, false]]);

check('mod: divisor and remainder', mod('age', 2, 0), [
    [{ age: 18 }, true],
    [{ age: '18' }, false],
    [{ age: null }, false],
    [{}, false],
]);
check('mod: remainder mismatch', mod('age', 2, 1), [[{ age: 18 }, false]]);
check('mod: negative operand keeps the sign', mod('age', 3, -1), [[{ age: -4 }, true]]);
check('mod: zero divisor never matches', mod('age', 0, 0), [[{ age: 18 }, false]]);
check('mod: malformed tuple', new Filter('mod', 'age', [2]), [[{ age: 18 }, false]]);
check('mod: scalar value', new Filter('mod', 'age', 2), [[{ age: 18 }, false]]);
check('mod: some array element', mod('scores', 2, 0), [
    [{ scores: [1, 4] }, true],
    [{ scores: [1, 3] }, false],
]);

check('size: exact length', size('tags', 2), [
    [{ tags: ['a', 'b'] }, true],
    [{ tags: ['a'] }, false],
    [{ tags: 'ab' }, false],
]);
check('size 0', size('tags', 0), [
    [{ tags: [] }, true],
    [{ tags: null }, false],
    [{}, false],
]);
check('size: the array itself, not its elements', size('matrix', 2), [[{ matrix: [[1, 2]] }, false]]);
check('size: outer length', size('matrix', 1), [[{ matrix: [[1, 2]] }, true]]);
check('size: negative value', new Filter('size', 'tags', -1), [[{ tags: [] }, false]]);
check('size: fractional value', new Filter('size', 'tags', 1.5), [[{ tags: ['a'] }, false]]);
check('size: string value', new Filter('size', 'tags', '1'), [[{ tags: ['a'] }, false]]);

// -----------------------------------------------------------
// in / nin
// -----------------------------------------------------------

check('in: membership', inArray('id', [1, 2]), [
    [{ id: 1 }, true],
    [{ id: 3 }, false],
]);
check('in: empty list matches nothing', inArray('id', []), [[{ id: 1 }, false]]);
check('nin: empty list matches everything', nin('id', []), [[{ id: 1 }, true]]);
check('in: non-array value', new Filter('in', 'id', 'nope'), [
    [{ id: 'nope' }, false],
    [{ id: 'other' }, false],
]);
check('in: null element', inArray('realm_id', [1, null]), [
    [{ realm_id: 1 }, true],
    [{ realm_id: null }, true],
    [{}, true],
    [{ realm_id: 2 }, false],
]);
check('in: no null element', inArray('realm_id', [1, 2]), [
    [{ realm_id: null }, false],
    [{}, false],
]);
check('nin: complement of in', nin('id', [1, 2]), [
    [{ id: 3 }, true],
    [{ id: 1 }, false],
    [{ id: null }, true],
    [{}, true],
]);
check('nin: null element', nin('id', [1, null]), [
    [{ id: null }, false],
    [{}, false],
    [{ id: 2 }, true],
]);
check('in: only null elements', inArray('id', [null]), [
    [{ id: null }, true],
    [{ id: 1 }, false],
]);
check('eq: element membership', eq('tags', 'a'), [
    [{ tags: ['a', 'b'] }, true],
    [{ tags: [] }, false],
]);
check('eq: element absent', eq('tags', 'c'), [[{ tags: ['a', 'b'] }, false]]);
check('ne: not containing', ne('tags', 'a'), [[{ tags: ['a', 'b'] }, false]]);
check('ne: element absent', ne('tags', 'c'), [[{ tags: ['a', 'b'] }, true]]);
check('in: intersection', inArray('tags', ['b', 'c']), [[{ tags: ['a', 'b'] }, true]]);
check('in: disjoint', inArray('tags', ['c', 'd']), [[{ tags: ['a', 'b'] }, false]]);
check('eq null: array holding null', eq('tags', null), [
    [{ tags: [null] }, true],
    [{ tags: [] }, false],
]);

// -----------------------------------------------------------
// text
// -----------------------------------------------------------

check('contains: case-insensitive substring', contains('name', 'eter'), [
    [{ name: 'Peter' }, true],
    [{ name: null }, false],
    [{}, false],
    [{ name: true }, false],
    [{ name: {} }, false],
]);
check('contains: folded condition', contains('name', 'PETER'), [[{ name: 'peter' }, true]]);
check('contains: miss', contains('name', 'x'), [[{ name: 'Peter' }, false]]);
check('startsWith: anchored', startsWith('name', 'pe'), [[{ name: 'Peter' }, true]]);
check('startsWith: not anchored elsewhere', startsWith('name', 'eter'), [[{ name: 'Peter' }, false]]);
check('endsWith: anchored', endsWith('name', 'TER'), [[{ name: 'Peter' }, true]]);
check('endsWith: not anchored elsewhere', endsWith('name', 'Pe'), [[{ name: 'Peter' }, false]]);
check('contains: literal, not a pattern', contains('name', 'a.c'), [
    [{ name: 'abc' }, false],
    [{ name: 'xa.cx' }, true],
]);
check('contains: regex metacharacters', contains('name', '(a+)*[b]$'), [
    [{ name: 'x(a+)*[b]$y' }, true],
    [{ name: 'aab' }, false],
]);
check('contains: numbers stringify', contains('age', '8'), [[{ age: 18 }, true]]);
check('startsWith: numbers stringify', startsWith('age', '1'), [[{ age: 18 }, true]]);
check('contains: number formatting', contains('price', '.5'), [
    [{ price: 1.5 }, true],
    [{ price: 2 }, false],
]);
check('contains: exponent formatting', contains('n', 'e+21'), [[{ n: 1e21 }, true]]);
check('notContains: complement', notContains('name', 'eter'), [[{ name: 'Peter' }, false]]);
check('notContains: null-inclusive', notContains('name', 'x'), [
    [{ name: 'Peter' }, true],
    [{ name: null }, true],
    [{}, true],
]);
check('notStartsWith: complement', notStartsWith('name', 'Pe'), [[{ name: 'Peter' }, false]]);
check('notEndsWith: null-inclusive', notEndsWith('name', 'ter'), [[{}, true]]);
check('contains: string array elements', contains('tags', 'oo'), [
    [{ tags: ['foo', 'bar'] }, true],
]);
check('contains: string array miss', contains('tags', 'zz'), [[{ tags: ['foo', 'bar'] }, false]]);
check('contains: non-ASCII folding', contains('name', 'ÜBER'), [[{ name: 'über alles' }, true]]);

check('regex: string pattern', regex('name', '^Pe'), [[{ name: 'Peter' }, true]]);
check('regex: case-sensitive by default', regex('name', '^pe'), [[{ name: 'Peter' }, false]]);
check('regex: non-textual values', regex('name', '.*'), [
    [{ name: null }, false],
    [{}, false],
]);
refuse('regex: malformed pattern', regex('name', '('), 'featureUnsupported');

// -----------------------------------------------------------
// case sensitivity
// -----------------------------------------------------------

check('eq: case-insensitive by default', eq('name', 'super hero'), [
    [{ name: 'Super Hero' }, true],
    [{ name: 'sUpEr HeRo' }, true],
    [{ name: 'super' }, false],
]);
check('ne: same case rule', ne('name', 'super hero'), [
    [{ name: 'Super Hero' }, false],
    [{ name: 'other' }, true],
]);
check('in: case-insensitive members', inArray('status', ['Active', 'Pending']), [
    [{ status: 'active' }, true],
    [{ status: 'PENDING' }, true],
    [{ status: 'closed' }, false],
]);
check('nin: same case rule', nin('status', ['Active']), [
    [{ status: 'active' }, false],
    [{ status: 'closed' }, true],
]);
check('eq: string null is not null', eq('name', 'null'), [[{ name: null }, false]]);
check('caseSensitive list: eq exact', eq('id', 'aBc'), [
    [{ id: 'aBc' }, true],
    [{ id: 'ABC' }, false],
], { caseSensitive: ['id'] });
check('caseSensitive list: in exact', inArray('id', ['aBc']), [
    [{ id: 'aBc' }, true],
    [{ id: 'abc' }, false],
], { caseSensitive: ['id'] });
check('caseSensitive true: eq exact', eq('name', 'super hero'), [
    [{ name: 'super hero' }, true],
    [{ name: 'Super Hero' }, false],
], { caseSensitive: true });
check('caseSensitive true: ne exact', ne('name', 'super hero'), [
    [{ name: 'super hero' }, false],
    [{ name: 'Super Hero' }, true],
], { caseSensitive: true });
check('caseSensitive true: in exact', inArray('status', ['Active', 'Pending']), [
    [{ status: 'Active' }, true],
    [{ status: 'active' }, false],
    [{ status: 'PENDING' }, false],
], { caseSensitive: true });
check('caseSensitive true: nin exact', nin('status', ['Active']), [
    [{ status: 'Active' }, false],
    [{ status: 'active' }, true],
], { caseSensitive: true });
check('caseSensitive true: dotted paths', eq('items.name', 'sword'), [
    [{ items: [{ name: 'sword' }] }, true],
    [{ items: [{ name: 'Sword' }] }, false],
], { caseSensitive: true });
check('caseSensitive true: elemMatch interiors', elemMatch('items', eq('name', 'sword')), [
    [{ items: [{ name: 'sword' }] }, true],
    [{ items: [{ name: 'Sword' }] }, false],
], { caseSensitive: true });
check('caseSensitive list: elemMatch composed path', elemMatch('items', eq('name', 'sword')), [
    [{ items: [{ name: 'Sword' }] }, false],
], { caseSensitive: ['items.name'] });
check('caseSensitive true: contains family', contains('name', 'ETER'), [
    [{ name: 'PETER' }, true],
    [{ name: 'Peter' }, false],
], { caseSensitive: true });
check('caseSensitive list: other field', contains('name', 'ETER'), [
    [{ name: 'Peter' }, true],
], { caseSensitive: ['other'] });
check('caseSensitive false: default', eq('name', 'super hero'), [
    [{ name: 'Super Hero' }, true],
    [{ name: 'super' }, false],
], { caseSensitive: false });

// -----------------------------------------------------------
// compounds
// -----------------------------------------------------------

check('and', and(eq('name', 'Peter'), gte('age', 18)), [
    [{ name: 'Peter', age: 28 }, true],
    [{ name: 'Peter', age: 17 }, false],
    [{ name: 'Aston', age: 28 }, false],
]);
check('or', or(eq('name', 'Peter'), gte('age', 18)), [
    [{ name: 'Peter', age: 17 }, true],
    [{ name: 'Aston', age: 18 }, true],
    [{ name: 'Aston', age: 17 }, false],
]);
check('nested compounds', or(and(eq('name', 'Peter'), gte('age', 18)), eq('admin', true)), [
    [{ name: 'Peter', age: 20 }, true],
    [{
        name: 'Aston', 
        age: 20, 
        admin: true, 
    }, true],
    [{ name: 'Aston', age: 20 }, false],
]);
check('empty and: match-all', and(), [[{ id: 1 }, true]]);
check('empty or: match-all', or(), [[{ id: 1 }, true]]);
check('empty nested compound vanishes', and(eq('id', 1), or()), [
    [{ id: 1 }, true],
    [{ id: 2 }, false],
]);
check('only empty compounds', or(and(), or()), [[{ id: 1 }, true]]);
check('empty or child vanishes', or(eq('id', 1), and()), [
    [{ id: 1 }, true],
    [{ id: 2 }, false],
]);
check('nor: exact complement', new Filters('nor', [eq('id', 1), eq('id', 2)]), [
    [{ id: 3 }, true],
    [{ id: 1 }, false],
    [{ id: 2 }, false],
]);
check('not group', not(and(eq('name', 'Peter'), gte('age', 18))), [
    [{ name: 'Peter', age: 28 }, false],
    [{ name: 'Peter', age: 17 }, true],
]);
check('not: null-inclusive complement', not(gt('age', 50)), [
    [{ age: 18 }, true],
    [{ age: null }, true],
    [{}, true],
    [{ age: 60 }, false],
]);
check('not or: null-inclusive', not(or(gt('age', 50), eq('name', 'Peter'))), [
    [{ age: null, name: null }, true],
    [{ age: 60, name: null }, false],
    [{ age: null, name: 'Peter' }, false],
]);
check('double negation cancels', not(not(gt('age', 50))), [
    [{ age: 60 }, true],
    [{ age: 18 }, false],
    [{ age: null }, false],
]);
check('not size', not(size('items', 2)), [
    [{ items: [1, 2] }, false],
    [{ items: [1] }, true],
    [{}, true],
]);
check('not elemMatch', not(elemMatch('items', eq('id', 1))), [
    [{ items: [{ id: 1 }] }, false],
    [{ items: [{ id: 2 }] }, true],
    [{ items: [] }, true],
]);
refuse('unknown compound operator', new Filters('xor', [eq('id', 1)]), 'operatorUnsupported');
refuse('unknown filter operator', new Filter('like', 'name', 'Peter'), 'operatorUnsupported');

// -----------------------------------------------------------
// join-row binding
// -----------------------------------------------------------

const user = {
    name: 'Peter',
    items: [
        {
            id: 1, 
            active: false, 
            title: 'first', 
        },
        {
            id: 2, 
            active: true, 
            title: 'second', 
        },
    ],
};

check('binding: some element', eq('items.id', 1), [[user, true]]);
check('binding: no element', eq('items.id', 3), [[user, false]]);
check('binding: same element for one path', and(eq('items.id', 1), eq('items.active', true)), [
    [user, false],
    [{ items: [{ id: 1, active: true }] }, true],
]);
check('binding: or per element combination', or(eq('items.id', 3), eq('items.active', true)), [
    [user, true],
    [{ items: [{ id: 1, active: false }] }, false],
]);
check('binding: independent paths', and(eq('items.id', 1), eq('realm.name', 'master')), [
    [{ ...user, realm: { name: 'master' } }, true],
    [user, false],
]);
check('binding: null row for empty or absent arrays', eq('items.id', null), [
    [{ items: [] }, true],
    [{}, true],
    [user, false],
]);
check('binding: exists false over empty array', exists('items.id', false), [[{ items: [] }, true]]);
check('binding: ne over empty array', ne('items.title', 'first'), [[{ items: [] }, true]]);
check('binding: negation quantified per element', ne('items.title', 'first'), [
    [user, true],
    [{ items: [{ id: 1, title: 'first' }] }, false],
]);
check('binding: to-one path', eq('realm.name', 'master'), [
    [{ realm: { id: 1, name: 'master' } }, true],
]);
check('binding: to-one miss', eq('realm.name', 'other'), [[{ realm: { id: 1, name: 'master' } }, false]]);
check('binding: null to-one', eq('realm.name', null), [[{ realm: null }, true]]);

const nested = {
    items: [
        { id: 1, parts: [{ id: 10, name: 'bolt' }] },
        { id: 2, parts: [{ id: 20, name: 'nut' }] },
    ],
};

check('binding: nested per parent element', and(eq('items.id', 2), eq('items.parts.name', 'nut')), [[nested, true]]);
check('binding: nested across parents', and(eq('items.id', 2), eq('items.parts.name', 'bolt')), [[nested, false]]);

check('elemMatch: same element', elemMatch('items', and(eq('id', 2), eq('active', true))), [[user, true]]);
check('elemMatch: no single element', elemMatch('items', and(eq('id', 1), eq('active', true))), [[user, false]]);
check('elemMatch: nested prefixes', elemMatch('items', elemMatch('parts', and(eq('id', 10), eq('name', 'bolt')))), [
    [{ items: [{ id: 1, parts: [{ id: 10, name: 'bolt' }] }] }, true],
]);
check('elemMatch: nested miss', elemMatch('items', elemMatch('parts', and(eq('id', 10), eq('name', 'nut')))), [
    [{ items: [{ id: 1, parts: [{ id: 10, name: 'bolt' }] }] }, false],
]);
check('elemMatch: to-one object', elemMatch('realm', and(eq('id', 1), eq('name', 'master'))), [
    [{ realm: { id: 1, name: 'master' } }, true],
]);
check('elemMatch: to-one miss', elemMatch('realm', eq('name', 'other')), [[{ realm: { id: 1, name: 'master' } }, false]]);
check('elemMatch: independent scopes', and(elemMatch('items', eq('id', 1)), elemMatch('items', eq('active', true))), [
    [user, true],
    [{ items: [{ id: 1, active: true }] }, true],
    [{ items: [{ id: 1, active: false }] }, false],
]);
check('elemMatch: independent of dotted siblings', and(elemMatch('items', eq('id', 1)), eq('items.active', true)), [
    [user, true],
    [{ items: [{ id: 1, active: true }] }, true],
    [{ items: [{ id: 1, active: false }] }, false],
]);
check('elemMatch: dotted field', elemMatch('items.tags', eq(ITSELF, 'x')), [
    [{ items: [{ tags: ['y'] }, { tags: ['x'] }] }, true],
    [{ items: [{ tags: ['y'] }] }, false],
]);
refuse('elemMatch: non-condition value', new Filter('elemMatch', 'items', { id: 1 }), 'featureUnsupported');

check('ITSELF: element itself', elemMatch('scores', new Filter('gt', ITSELF, 8)), [[{ scores: [3, 7, 9] }, true]]);
check('ITSELF: no element', elemMatch('scores', new Filter('gt', ITSELF, 10)), [[{ scores: [3, 7, 9] }, false]]);
check('ITSELF: same element', elemMatch('scores', and(new Filter('gt', ITSELF, 5), new Filter('lt', ITSELF, 8))), [
    [{ scores: [3, 7] }, true],
    [{ scores: [3, 9] }, false],
]);
check('ITSELF: $all desugar', and(elemMatch('tags', eq(ITSELF, 'a')), elemMatch('tags', eq(ITSELF, 'b'))), [
    [{ tags: ['a', 'b', 'c'] }, true],
    [{ tags: ['a', 'c'] }, false],
    [{ tags: [] }, false],
]);
check('ITSELF: missing, scalar or empty sources', elemMatch('scores', eq(ITSELF, 5)), [
    [{ scores: [5] }, true],
    [{ scores: [] }, false],
    [{ scores: 5 }, false],
    [{ scores: null }, false],
    [{}, false],
]);
check('ITSELF: null test never matches the NULL row', elemMatch('scores', eq(ITSELF, null)), [
    [{ scores: [] }, false],
    [{ scores: [null] }, true],
]);
check('ITSELF: element-level size', elemMatch('matrix', size(ITSELF, 2)), [
    [{ matrix: [[1], [1, 2]] }, true],
    [{ matrix: [[1], [1, 2, 3]] }, false],
]);
check('ITSELF: arrays of arrays', elemMatch('matrix', elemMatch(ITSELF, new Filter('gt', ITSELF, 5))), [
    [{ matrix: [[1, 2], [3, 9]] }, true],
    [{ matrix: [[1, 2], [3, 4]] }, false],
    [{ matrix: [1, 9] }, false],
]);
check('ITSELF: case-insensitive elements', elemMatch('tags', eq(ITSELF, 'Chess')), [[{ tags: ['chess'] }, true]]);
refuse('ITSELF: outside elemMatch', eq(ITSELF, 5), 'featureUnsupported');
refuse('ITSELF: elemMatch target outside elemMatch', elemMatch(ITSELF, eq('id', 1)), 'featureUnsupported');

// -----------------------------------------------------------
// complement law (verdicts computed by the reference)
// -----------------------------------------------------------

const complementInputs : Record[] = [
    { value: 'Peter' },
    { value: 'peter' },
    { value: '' },
    { value: 18 },
    { value: 0 },
    { value: null },
    {},
    { value: true },
    { value: ['a', 'b'] },
    { value: [] },
    { value: { nested: true } },
];

const complementPairs : [string, ICondition, ICondition][] = [
    ['eq/ne', eq('value', 'Peter'), ne('value', 'Peter')],
    ['eq/ne (null)', eq('value', null), ne('value', null)],
    ['in/nin', inArray('value', ['Peter', 18]), nin('value', ['Peter', 18])],
    ['in/nin (null element)', inArray('value', [18, null]), nin('value', [18, null])],
    ['in/nin (empty)', inArray('value', []), nin('value', [])],
    ['contains/notContains', contains('value', 'ete'), notContains('value', 'ete')],
    ['startsWith/notStartsWith', startsWith('value', 'Pe'), notStartsWith('value', 'Pe')],
    ['endsWith/notEndsWith', endsWith('value', 'er'), notEndsWith('value', 'er')],
    ['exists true/false', exists('value'), exists('value', false)],
    ['gt/not gt', gt('value', 10), not(gt('value', 10))],
];

for (const [name, positive, negative] of complementPairs) {
    for (const [label, condition] of [['positive', positive], ['negative', negative]] as const) {
        const predicate = compileFilters(condition);

        check(
            `complement law: ${name} (${label})`,
            condition,
            complementInputs.map((record) => [record, predicate(record)]),
        );
    }
}

// -----------------------------------------------------------

/**
 * Every group, after asserting the reference agrees with the
 * hand-written verdicts (a fixture the reference disagrees with is a
 * mistake in the fixture, not a finding).
 */
export function buildEvaluateGroups() : EvaluateGroup[] {
    for (const group of groups) {
        if (group.error) {
            let code : string | undefined;
            try {
                compileFilters(fromGroup(group), group.options);
            } catch (e) {
                code = isBaseError(e) ? e.code : undefined;
            }

            if (code !== group.error) {
                throw new Error(`${group.name}: expected ${group.error}, got ${code}`);
            }

            continue;
        }

        const predicate = compileFilters(fromGroup(group), group.options);
        for (const item of group.cases ?? []) {
            if (predicate(item.record) !== item.expected) {
                throw new Error(`${group.name}: ${JSON.stringify(item.record)} expected ${item.expected}`);
            }
        }
    }

    return groups;
}

function fromGroup(group: EvaluateGroup) : ICondition {
    // the hand-built conditions round-trip through the IR, so the
    // fixtures exercise exactly what is serialized.
    return fromIR(group.filters);
}
