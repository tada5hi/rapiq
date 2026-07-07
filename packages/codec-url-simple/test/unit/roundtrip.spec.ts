/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Field,
    Fields,
    FilterCompoundOperator,
    Filters,
    Pagination,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    and,
    contains,
    defineQuery,
    elemMatch,
    endsWith,
    eq,
    exists,
    gt,
    gte,
    inArray,
    lt,
    lte,
    mod,
    ne,
    nin,
    notContains,
    notEndsWith,
    notStartsWith,
    or,
    regex,
    startsWith,
} from '@rapiq/core';
import type { IFilter, IQuery } from '@rapiq/core';
import { URLDecoder, URLEncoder } from '../../src';

/**
 * The codec contract (plan 007): decode(encode(q)) ≍ q for every query
 * within the simple dialect's expressible subset — modulo scalar type
 * normalization (the wire is untyped: '5' → 5, 'true' → true) — and a
 * loud, typed failure for every query outside it.
 */
describe('round-trip', () => {
    const encoder = new URLEncoder();
    const decoder = new URLDecoder();

    const roundTrip = (query: IQuery) : IQuery => {
        const encoded = encoder.encode(query);
        expect(encoded).toBeTypeOf('string');

        const decoded = decoder.decode(encoded!);
        expect(decoded).toBeDefined();

        return decoded!;
    };

    const roundTripFilter = (filter: IFilter) : unknown => roundTrip(
        defineQuery({ filters: filter }),
    ).filters;

    describe('filters (operator matrix)', () => {
        it.each([
            ['eq string', eq('name', 'John')],
            ['eq number', eq('age', 18)],
            ['eq zero', eq('age', 0)],
            ['eq negative number', eq('age', -1)],
            ['eq true', eq('flag', true)],
            ['eq false', eq('flag', false)],
            ['eq null', eq('email', null)],
            ['eq date-like string', eq('created_at', '2026-01-01')],
            ['ne string', ne('name', 'John')],
            ['ne null', ne('email', null)],
            ['lt', lt('age', 65)],
            ['lte', lte('age', 65)],
            ['gt', gt('age', 18)],
            ['gte', gte('age', 18)],
            ['gte negative', gte('age', -10)],
            ['in numbers', inArray('id', [1, 2, 3])],
            ['in with null element', inArray('realm_id', ['master', null])],
            ['in with boolean elements', inArray('flag', [true, false])],
            ['nin', nin('id', [1, 2])],
            ['nin with null element', nin('realm_id', ['master', null])],
            ['startsWith', startsWith('name', 'Jo')],
            ['notStartsWith', notStartsWith('name', 'Jo')],
            ['endsWith', endsWith('name', 'hn')],
            ['notEndsWith', notEndsWith('name', 'hn')],
            ['contains', contains('name', 'oh')],
            ['notContains', notContains('name', 'oh')],
            ['contains with interior tilde', contains('name', 'a~b')],
            ['startsWith numeric-looking text', startsWith('code', '5')],
        ])('should round-trip %s', (_, filter) => {
            expect(roundTripFilter(filter)).toEqual(
                new Filters(FilterCompoundOperator.AND, [filter]),
            );
        });

        it.each([
            [
                'eq numeric string normalizes to number',
                eq('code', '5'),
                eq('code', 5),
            ],
            [
                'eq boolean-like string normalizes to boolean',
                eq('flag', 'true'),
                eq('flag', true),
            ],
            [
                'eq null-like string normalizes to null',
                eq('email', 'null'),
                eq('email', null),
            ],
            [
                'singleton in normalizes to eq',
                inArray('id', [1]),
                eq('id', 1),
            ],
            [
                'like match text stringifies non-string values',
                startsWith('code', 5),
                startsWith('code', '5'),
            ],
        ])('should round-trip %s', (_, filter, expected) => {
            expect(roundTripFilter(filter)).toEqual(
                new Filters(FilterCompoundOperator.AND, [expected]),
            );
        });
    });

    describe('filters (outside the dialect subset)', () => {
        const expectTypedFailure = (filter: Parameters<typeof and>[0], code: string) => {
            const query = defineQuery({ filters: filter });

            try {
                encoder.encode(query);
                expect.fail('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(AdapterError);
                expect((e as AdapterError).code).toBe(code);
            }
        };

        it.each([
            ['regex', regex('name', /^Jo/)],
            ['mod', mod('age', [2, 0])],
            ['exists', exists('email', true)],
            ['elemMatch', elemMatch('items', eq('name', 'a'))],
        ])('should throw for the %s operator (no wire syntax)', (_, filter) => {
            expectTypedFailure(filter, ErrorCode.OPERATOR_UNSUPPORTED);
        });

        it.each([
            ['or compound', or(gte('age', 18), eq('email', null))],
            ['nested compound', and(eq('name', 'John'), or(gte('age', 18), eq('email', null)))],
            ['two conditions on the same field', and(gte('age', 18), lt('age', 65))],
            ['eq comma string (would decode as in)', eq('name', 'a,b')],
            ['in element with comma', inArray('name', ['a,b', 'c'])],
            ['contains comma match text (comma-split precedes marker parsing)', contains('name', 'a,b')],
            ['eq empty string (would be dropped)', eq('name', '')],
            ['empty in list (would be dropped)', inArray('id', [])],
            ['contains empty match text (would be dropped)', contains('name', '')],
            ['eq trailing tilde (would decode as startsWith)', eq('name', 'foo~')],
            ['eq leading negation (would decode as ne)', eq('name', '!x')],
            ['eq leading comparison marker (would decode as lt)', eq('name', '<5')],
            ['startsWith leading tilde (would decode as contains)', startsWith('name', '~x')],
            ['endsWith trailing tilde (would decode as contains)', endsWith('name', 'x~')],
            ['startsWith leading negation (would decode negated)', startsWith('name', '!x')],
        ])('should throw for %s', (_, filter) => {
            expectTypedFailure(filter, ErrorCode.FEATURE_UNSUPPORTED);
        });
    });

    describe('full query', () => {
        it('should round-trip every parameter', () => {
            const query = defineQuery({
                fields: ['id', 'name'],
                filters: and(eq('name', 'John'), gte('age', 18)),
                pagination: { limit: 20, offset: 10 },
                relations: ['realm', 'items.realm'],
                sort: ['-id', 'name'],
            });

            const decoded = roundTrip(query);

            expect(decoded.fields).toEqual(new Fields([
                new Field('id'),
                new Field('name'),
            ]));
            expect(decoded.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                eq('name', 'John'),
                gte('age', 18),
            ]));
            expect(decoded.pagination).toEqual(new Pagination(20, 10));
            // nested include paths imply their parents — the decoder
            // materializes them (normalization, not lossiness).
            expect(decoded.relations).toEqual(new Relations([
                new Relation('items'),
                new Relation('realm'),
                new Relation('items.realm'),
            ]));
            expect(decoded.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
                new Sort('name', SortDirection.ASC),
            ]));
        });

        it('should be idempotent after one round-trip', () => {
            const query = defineQuery({
                fields: ['id', 'name'],
                filters: { code: '5', flag: 'true' },
                sort: '-id',
            });

            const once = roundTrip(query);
            const twice = roundTrip(once);

            expect(encoder.encode(twice)).toEqual(encoder.encode(once));
            expect(twice.filters).toEqual(once.filters);
            expect(twice.fields).toEqual(once.fields);
            expect(twice.sorts).toEqual(once.sorts);
        });
    });
});
