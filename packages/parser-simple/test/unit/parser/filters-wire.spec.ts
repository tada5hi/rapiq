/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, FILTER_OPERATOR_SEMANTICS } from '@rapiq/core';
import {
    FILTER_WIRE_NEGATION,
    FILTER_WIRE_SPEC,
    decodeFilterWireValue,
    encodeFilterWireValue,
} from '../../../src';

/**
 * The wire grammar's direct boundary spec: token ↔ condition, no
 * parser, schema or codec in the loop. The wire format is FROZEN
 * (v1-compatible legacy dialect) — these cases pin its bytes,
 * including the degenerate quirks.
 */
describe('src/parameter/filters/wire/*.ts', () => {
    describe('decode', () => {
        it.each([
            ['plain equality with coercion', '18', 'eq', 18],
            ['negated equality', '!John', 'ne', 'John'],
            ['null value', 'null', 'eq', null],
            ['negated null value', '!null', 'ne', null],
            ['boolean coercion', 'true', 'eq', true],
            ['contains with raw inner text', '~oh~', 'contains', 'oh'],
            ['negated contains', '!~oh~', 'notContains', 'oh'],
            ['startsWith', 'Jo~', 'startsWith', 'Jo'],
            ['negated startsWith', '!Jo~', 'notStartsWith', 'Jo'],
            ['endsWith', '~hn', 'endsWith', 'hn'],
            ['negated endsWith', '!~hn', 'notEndsWith', 'hn'],
            ['lte beats lt on shared prefix', '<=5', 'lte', 5],
            ['lt', '<5', 'lt', 5],
            ['gte beats gt on shared prefix', '>=5', 'gte', 5],
            ['gt', '>5', 'gt', 5],
        ])('should decode %s', (_, wire, operator, value) => {
            expect(decodeFilterWireValue(wire)).toEqual({
                success: true,
                condition: { operator, value },
            });
        });

        it.each([
            ['comma list', '1,2,3', 'in', [1, 2, 3]],
            ['pre-split array', ['1', '2'], 'in', [1, 2]],
            ['negated first element lifts to nin', '!a,b', 'nin', ['a', 'b']],
            ['later elements stay unparsed', '!a,!b', 'nin', ['a', '!b']],
            ['markers are inert inside lists', '<5,10', 'in', ['<5', 10]],
            ['empty comma list', ',', 'in', []],
        ])('should decode %s (membership is a value shape)', (_, wire, operator, value) => {
            expect(decodeFilterWireValue(wire)).toEqual({
                success: true,
                condition: { operator, value },
            });
        });

        it.each([
            ['negation before a comparison is discarded', '!<5', 'lt', 5],
            ['negation before lte is discarded', '!<=5', 'lte', 5],
            ['raw LIKE text is never coerced', '~5~', 'contains', '5'],
            ['degenerate single marker (substring swap)', '~', 'contains', '~'],
            ['LIKE beats comparison markers', '~<5', 'endsWith', '<5'],
            ['suffix LIKE beats comparison prefixes', '<5~', 'startsWith', '<5'],
        ])('should keep the frozen quirk: %s', (_, wire, operator, value) => {
            expect(decodeFilterWireValue(wire)).toEqual({
                success: true,
                condition: { operator, value },
            });
        });

        it.each([
            ['empty string', ''],
            ['bare negation', '!'],
            ['bare comparison marker', '<='],
            ['empty LIKE pair', '~~'],
        ])('should return the valueEmpty verdict for %s', (_, wire) => {
            expect(decodeFilterWireValue(wire)).toEqual({
                success: false,
                code: 'valueEmpty',
            });
        });

        it.each([
            ['plain object', { nested: true }],
            ['boolean input', true],
        ])('should return the valueInvalid verdict for %s', (_, input) => {
            expect(decodeFilterWireValue(input)).toEqual({
                success: false,
                code: 'valueInvalid',
            });
        });

        it('should decode absent input as an equality on null', () => {
            expect(decodeFilterWireValue(undefined)).toEqual({
                success: true,
                condition: { operator: 'eq', value: null },
            });
            expect(decodeFilterWireValue(null)).toEqual({
                success: true,
                condition: { operator: 'eq', value: null },
            });
        });
    });

    describe('encode', () => {
        it.each([
            ['eq', { operator: 'eq', value: 18 }, '18'],
            ['ne', { operator: 'ne', value: 'John' }, '!John'],
            ['eq null', { operator: 'eq', value: null }, 'null'],
            ['lt', { operator: 'lt', value: 5 }, '<5'],
            ['lte', { operator: 'lte', value: 5 }, '<=5'],
            ['gt', { operator: 'gt', value: 5 }, '>5'],
            ['gte', { operator: 'gte', value: 5 }, '>=5'],
            ['in', { operator: 'in', value: [1, 2, 3] }, '1,2,3'],
            ['in singleton (decodes as eq, lifted back by shape)', { operator: 'in', value: [5] }, '5'],
            ['nin', { operator: 'nin', value: ['a', 'b'] }, '!a,b'],
            ['nin singleton', { operator: 'nin', value: [5] }, '!5'],
            ['contains', { operator: 'contains', value: 'oh' }, '~oh~'],
            ['notContains', { operator: 'notContains', value: 'oh' }, '!~oh~'],
            ['startsWith', { operator: 'startsWith', value: 'Jo' }, 'Jo~'],
            ['notStartsWith', { operator: 'notStartsWith', value: 'Jo' }, '!Jo~'],
            ['endsWith', { operator: 'endsWith', value: 'hn' }, '~hn'],
            ['notEndsWith', { operator: 'notEndsWith', value: 'hn' }, '!~hn'],
        ])('should encode %s', (_, condition, wire) => {
            expect(encodeFilterWireValue(condition)).toEqual(wire);
        });

        it.each([
            ['marker collision (would re-decode as startsWith)', {
                operator: 'eq', 
                field: 'name', 
                value: 'foo~', 
            }],
            ['comma string (would re-decode as in)', { operator: 'eq', value: 'a,b' }],
            ['empty string', { operator: 'eq', value: '' }],
            ['whitespace-only string', { operator: 'eq', value: ' ' }],
            ['empty array', { operator: 'in', value: [] }],
            ['empty LIKE text', { operator: 'contains', value: '' }],
            ['non-scalar value', { operator: 'eq', value: { nested: true } }],
        ])('should reject %s with a typed error (subset law)', (_, condition) => {
            expect(() => encodeFilterWireValue(condition)).toThrow(AdapterError);
        });

        it.each([
            ['regex'],
            ['mod'],
            ['size'],
            ['exists'],
            ['elemMatch'],
        ])('should reject the %s operator (no wire spelling)', (operator) => {
            expect(() => encodeFilterWireValue({ operator, value: 'x' })).toThrow(AdapterError);
        });
    });

    describe('spec-table agreement', () => {
        it('should decode every row back to its own operator (order = precedence, no shadowing)', () => {
            const operators = Object.keys(FILTER_WIRE_SPEC) as
            (keyof typeof FILTER_WIRE_SPEC)[];

            for (const operator of operators) {
                const wire = encodeFilterWireValue({ operator, value: 'x' });
                const decoded = decodeFilterWireValue(wire);

                expect(decoded).toEqual({
                    success: true,
                    condition: { operator, value: 'x' },
                });
            }
        });

        it('should spell every complement twin through the negation modifier', () => {
            const complements = Object.entries(FILTER_OPERATOR_SEMANTICS)
                .flatMap(([operator, semantics]) => (
                    'complementOf' in semantics &&
                    semantics.complementOf in FILTER_WIRE_SPEC ?
                        [[operator, semantics.complementOf]] :
                        []
                ));

            // the wire-expressible complement pairs, exactly.
            expect(complements.map(([operator]) => operator).sort()).toEqual([
                'ne', 
                'notContains', 
                'notEndsWith', 
                'notStartsWith',
            ]);

            for (const [operator, positive] of complements) {
                const wire = encodeFilterWireValue({ operator, value: 'x' });
                const positiveWire = encodeFilterWireValue({ operator: positive, value: 'x' });

                expect(wire).toEqual(`${FILTER_WIRE_NEGATION}${positiveWire}`);
                expect(decodeFilterWireValue(wire)).toEqual({
                    success: true,
                    condition: { operator, value: 'x' },
                });
            }
        });
    });
});
