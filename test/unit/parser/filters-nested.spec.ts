/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import type { FieldCondition } from '@ucast/core';
import { CompoundCondition } from '@ucast/core';
import {
    FiltersParser,
} from '../../../src';

describe('src/parser/filters-nested.ts', () => {
    let parser: FiltersParser;

    beforeAll(() => {
        parser = new FiltersParser();
    });

    it('should parse nested filters', () => {
        // filter id
        const output = parser.parse({
            '01:id': 1,
            '01:name': 'admin',
            '02:age': 15,
        });

        expect(output).toBeInstanceOf(CompoundCondition);
        expect(output.operator).toBe('or');
        expect(output.value).toHaveLength(2);

        const [first, second] = output.value as [CompoundCondition, FieldCondition];
        expect(first.operator).toBe('and');
        expect(first.value).toHaveLength(2);

        expect(second.operator).toBe('eq');
        expect(second.value).toBe(15);
        expect(second.field).toEqual('age');
    });
});
