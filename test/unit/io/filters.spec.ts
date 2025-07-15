/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { FieldCondition } from '@ucast/core';
import { CompoundCondition } from '@ucast/core';
import {
    FilterCompoundOperator, FiltersParser, and, filters, or,
} from '../../../src';
import { registry } from '../../data/schema';
import type { Entity } from '../../data';

describe('src/filters', () => {
    let parser : FiltersParser;

    beforeAll(() => {
        parser = new FiltersParser(registry);
    });

    it('should build & parse', () => {
        /**
         * 00:id
         * 000:name
         * 001:name
         * 1:id
         */
        const group = or([
            and([
                filters<Entity>({
                    id: 1,
                }),
                or([
                    filters<Entity>({
                        name: 'foo',
                    }),
                    filters<Entity>({
                        name: 'bar',
                    }),
                ]),
            ]),

            filters<Entity>({
                id: 15,
            }),
        ]);

        const output = parser.parse(group.normalize());

        expect(output).toBeInstanceOf(CompoundCondition);
        expect(output.operator).toEqual(FilterCompoundOperator.OR);

        expect(output.value).toHaveLength(2);

        const children = (output as CompoundCondition).value;
        expect(children).toHaveLength(2);

        const [first, second] = children as [
            CompoundCondition,
            FieldCondition,
        ];
        expect(first).toBeInstanceOf(CompoundCondition);

        expect(second).toBeInstanceOf(CompoundCondition);

        const [secondFirst] = (second as CompoundCondition).value as [FieldCondition];

        expect(secondFirst.operator).toEqual('eq');
        expect(secondFirst.value).toEqual(15);
        expect(secondFirst.field).toEqual('id');
    });
});
