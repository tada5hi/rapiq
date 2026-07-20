/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    FilterCompoundOperator,
    Filters,
    FiltersParseError,
    eq,
} from '@rapiq/core';
import {
    ExpressionFiltersParser,
    FILTER_EXPRESSION_KEYWORDS,
} from '@rapiq/parser-expression';
import { serializeFiltersExpression } from '../../src/expression';

/**
 * The expression encoder PREDICTS tokenizer acceptance: it consumes
 * FILTER_EXPRESSION_KEYWORDS + FILTER_FIELD_SEGMENT_PATTERN from
 * @rapiq/parser-expression to decide which field names it may emit.
 * These specs assert the prediction against the parser's actual
 * behavior, in both directions:
 *
 * - accepted names must decode back to the same condition (an
 *   over-permissive encoder would emit undecodable/mis-decoding
 *   tokens);
 * - rejected names must also fail to decode when hand-spelled (an
 *   over-conservative encoder would refuse expressible conditions).
 */
describe('expression encoder ↔ parser-expression tokenizer agreement', () => {
    const parser = new ExpressionFiltersParser();

    const encodeField = (field: string) => serializeFiltersExpression(
        new Filters(FilterCompoundOperator.AND, [eq(field, 'x')]),
    );

    const decodeField = (field: string) => parser.parse(`eq(${field},'x')`);

    it.each([
        ['plain identifier', 'name'],
        ['keyword superstring (or)', 'order'],
        ['keyword superstring (not)', 'notes'],
        ['keyword superstring (in)', 'input'],
        ['uppercase keyword spelling', 'EQ'],
        ['prototype-inherited name', 'toString'],
        ['prototype-inherited name (constructor)', 'constructor'],
        ['inner hyphen', 'first-name'],
        ['underscore-prefixed', '_id'],
        ['digits only', '123'],
        ['dotted relation path', 'items.name'],
    ])('should agree on accepting %s', (_, field) => {
        const wire = encodeField(field);

        // the hand-spelled form below must match what the encoder
        // emits, otherwise the reject cases test a different wire.
        expect(wire).toEqual(`eq(${field},'x')`);

        expect(parser.parse(wire!)).toEqual(
            new Filters(FilterCompoundOperator.AND, [eq(field, 'x')]),
        );
    });

    it.each([
        // every exported keyword must actually be claimed by the
        // tokenizer — if one stops being a keyword, the encoder
        // rejects a field the dialect could express.
        ...Object.keys(FILTER_EXPRESSION_KEYWORDS).map(
            (keyword) => [`keyword field (${keyword})`, keyword] as [string, string],
        ),
        ['keyword path segment', 'items.size'],
        ['embedded whitespace', 'a b'],
        ['leading hyphen', '-name'],
        ['trailing hyphen', 'name-'],
        ['empty path segment', 'a..b'],
        ['reserved $-marker', '$foo'],
        ['non-ascii identifier', 'naïve'],
    ])('should agree on rejecting %s', (_, field) => {
        expect(() => encodeField(field)).toThrow(AdapterError);
        expect(() => decodeField(field)).toThrow(FiltersParseError);
    });
});
