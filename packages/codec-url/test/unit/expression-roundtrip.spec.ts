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
    ITSELF,
    Pagination,
    Query,
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
    isFilters,
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
import type {
    ICondition, 
    IFilter, 
    IFilters, 
    IQuery,
} from '@rapiq/core';
import { ExpressionURLDecoder, ExpressionURLEncoder } from '../../src/expression';

/**
 * The expression dialect's expressible subset is wider than the
 * simple dialect's: nested and/or compounds, comma-containing
 * strings and same-field conditions all round-trip. The law stays
 * the same: decode(encode(q)) ≍ q modulo scalar type normalization,
 * loud typed failure outside the subset.
 */
describe('round-trip', () => {
    const encoder = new ExpressionURLEncoder();
    const decoder = new ExpressionURLDecoder();

    const roundTrip = (query: IQuery) : IQuery => {
        const encoded = encoder.encode(query);
        expect(encoded).toBeTypeOf('string');

        const decoded = decoder.decode(encoded!);
        expect(decoded).toBeDefined();

        return decoded!;
    };

    const roundTripFilter = (filter: IFilter | IFilters) : unknown => roundTrip(
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
            ['eq comma string', eq('name', 'a,b')],
            ['eq quoted text', eq('name', 'it\'s')],
            ['ne string', ne('name', 'John')],
            ['ne null', ne('email', null)],
            ['lt', lt('age', 65)],
            ['lte', lte('age', 65)],
            ['gt', gt('age', 18)],
            ['gte', gte('age', 18)],
            ['in numbers', inArray('id', [1, 2, 3])],
            ['in with null element', inArray('realm_id', ['master', null])],
            ['in with comma element', inArray('name', ['a,b', 'c'])],
            ['in with boolean elements', inArray('flag', [true, false])],
            ['eq underscore-prefixed field', eq('_id', 'abc')],
            ['nin', nin('id', [1, 2])],
            ['startsWith', startsWith('name', 'Jo')],
            ['notStartsWith', notStartsWith('name', 'Jo')],
            ['endsWith', endsWith('name', 'hn')],
            ['notEndsWith', notEndsWith('name', 'hn')],
            ['contains', contains('name', 'oh')],
            ['notContains', notContains('name', 'oh')],
            ['contains with comma', contains('name', 'a,b')],
            ['relation path condition', eq('items.name', 'a')],
            ['elemMatch document form', elemMatch('items', eq('name', 'chess'))],
            ['elemMatch ITSELF leaf', elemMatch('scores', gt(ITSELF, 5))],
            ['nested elemMatch on the element itself', elemMatch('matrix', elemMatch(ITSELF, gt(ITSELF, 5)))],
            ['size', size('tags', 2)],
            ['size zero', size('tags', 0)],
            ['element-level size on the element itself', elemMatch('matrix', size(ITSELF, 2))],
        ])('should round-trip %s', (_, filter) => {
            expect(roundTripFilter(filter)).toEqual(
                new Filters(FilterCompoundOperator.AND, [filter]),
            );
        });

        it.each([
            [
                'flat root and',
                and(eq('name', 'John'), gte('age', 18)),
            ],
            [
                'root or',
                or(gte('age', 65), eq('status', 'retired')),
            ],
            [
                'nested compound',
                and(
                    eq('realm_id', 'master'),
                    or(gte('age', 18), eq('email', null)),
                ),
            ],
            [
                'same-field branches',
                and(gte('age', 18), lt('age', 65)),
            ],
            [
                'elemMatch compound interior',
                and(elemMatch('items', and(eq('id', 1), eq('active', true)))),
            ],
            [
                '$all desugar (independent element matches)',
                and(
                    elemMatch('tags', eq(ITSELF, 'a')),
                    elemMatch('tags', eq(ITSELF, 'b')),
                ),
            ],
        ])('should round-trip %s', (_, filters) => {
            expect(roundTripFilter(filters)).toEqual(filters);
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
        ])('should round-trip %s', (_, filter, expected) => {
            expect(roundTripFilter(filter)).toEqual(
                new Filters(FilterCompoundOperator.AND, [expected]),
            );
        });

        it.each([
            [
                'not over an ordering comparison',
                not(gt('age', 18)),
            ],
            [
                'not over a group',
                not(and(eq('name', 'John'), lt('age', 15))),
            ],
            [
                'not over size',
                not(size('tags', 2)),
            ],
            [
                'not over elemMatch',
                not(elemMatch('items', eq('name', 'chess'))),
            ],
            [
                'not nested inside a group',
                and(eq('realm_id', 'master'), not(gt('age', 18))),
            ],
        ])('should round-trip %s as a first-class NOT node', (_, filters) => {
            expect(roundTripFilter(filters)).toEqual(
                isFilters(filters as ICondition, FilterCompoundOperator.NOT) ?
                    new Filters(FilterCompoundOperator.AND, [filters]) :
                    filters,
            );
        });

        it('should normalize a wire not() around a twin-able leaf to the twin', () => {
            // not(eq) and ne lower to the identical plan — the twin is
            // the canonical decoded form.
            expect(roundTripFilter(not(eq('name', 'John')))).toEqual(
                new Filters(FilterCompoundOperator.AND, [ne('name', 'John')]),
            );

            expect(roundTripFilter(not(inArray('id', [1, 2])))).toEqual(
                new Filters(FilterCompoundOperator.AND, [nin('id', [1, 2])]),
            );
        });

        it('should serialize a multi-child NOT as the negated conjunction', () => {
            const encoded = encoder.encode(defineQuery({ filters: not(gt('age', 18), lt('age', 65)) }));

            expect(decodeURIComponent(encoded!))
                .toContain('not(and(gt(age,\'18\'),lt(age,\'65\')))');
        });
    });

    describe('filters (outside the dialect subset)', () => {
        const expectTypedFailure = (filter: IFilter | IFilters, code: string) => {
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
        ])('should throw for the %s operator (no grammar production)', (_, filter) => {
            expectTypedFailure(filter, ErrorCode.OPERATOR_UNSUPPORTED);
        });

        it.each([
            ['numeric-looking match text', startsWith('code', '5')],
            ['null-looking match text', contains('name', 'null')],
            ['whitespace-padded match text', startsWith('name', ' J')],
            ['null-looking eq value (would decode to IS NULL)', eq('name', 'null')],
            ['whitespace-padded eq value (would decode trimmed)', eq('name', ' John ')],
            ['value-mutating numeric text (0xFF would decode to 255)', eq('code', '0xFF')],
            ['NaN value (would decode to the string NaN)', eq('age', Number.NaN)],
            ['non-integer size value', size('tags', 2.5)],
            ['negative size value', size('tags', -1)],
            ['keyword field segment', eq('null', 'x')],
            ['elemMatch keyword field segment', eq('elemMatch', 'x')],
            ['size keyword field segment', eq('size', 'x')],
            ['non-tokenizable field segment', eq('a b', 'x')],
            ['empty nested compound', and(eq('name', 'x'), or())],
        ])('should throw for %s', (_, filter) => {
            expectTypedFailure(filter, ErrorCode.FEATURE_UNSUPPORTED);
        });

        it('should throw for the ITSELF marker outside an elemMatch interior', () => {
            // hand-built — defineQuery already rejects this shape.
            const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq(ITSELF, 'x')]) });

            try {
                encoder.encode(query);
                expect.fail('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(AdapterError);
                expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
            }
        });
    });

    describe('full query', () => {
        it('should round-trip every parameter', () => {
            const query = defineQuery({
                fields: ['id', 'name'],
                filters: or(eq('name', 'John'), gte('age', 18)),
                pagination: { limit: 20, offset: 10 },
                relations: ['realm'],
                sort: ['-id', 'name'],
            });

            const decoded = roundTrip(query);

            expect(decoded.fields).toEqual(new Fields([
                new Field('id'),
                new Field('name'),
            ]));
            expect(decoded.filters).toEqual(
                or(eq('name', 'John'), gte('age', 18)),
            );
            expect(decoded.pagination).toEqual(new Pagination(20, 10));
            expect(decoded.relations).toEqual(new Relations([
                new Relation('realm'),
            ]));
            expect(decoded.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
                new Sort('name', SortDirection.ASC),
            ]));
        });

        it('should surface a syntax error for an empty filter parameter', () => {
            // the expression dialect is precise: `filter=` is not absent
            // input and must not fall back to schema defaults.
            expect(() => decoder.decodeFilters('filter=')).toThrowError();
        });

        it('should emit the documented wire format', () => {
            const query = defineQuery({
                filters: and(eq('name', 'John'), or(gte('age', 18), eq('email', null))),
                pagination: { limit: 20 },
            });

            const encoded = encoder.encode(query);

            expect(decodeURIComponent(encoded!)).toEqual(
                'filter=and(eq(name,\'John\'),or(gte(age,\'18\'),eq(email,null)))&page[limit]=20',
            );
        });

        it('should emit the documented elemMatch wire format', () => {
            const query = defineQuery({ filters: elemMatch('scores', gt(ITSELF, 5)) });

            const encoded = encoder.encode(query);

            expect(decodeURIComponent(encoded!)).toEqual(
                'filter=elemMatch(scores,gt($this,\'5\'))',
            );
        });

        it('should emit the documented size wire format', () => {
            const query = defineQuery({ filters: size('tags', 2) });

            const encoded = encoder.encode(query);

            expect(decodeURIComponent(encoded!)).toEqual(
                'filter=size(tags,\'2\')',
            );
        });
    });
});
