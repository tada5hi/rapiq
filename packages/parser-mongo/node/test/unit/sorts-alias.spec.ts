/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { MongoParser } from '../../src';

describe('src/module.ts', () => {
    const parser = new MongoParser();

    it('should read the canonical sorts key', () => {
        const query = parser.parse({ sorts: { name: 'DESC' } });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['name', 'DESC']]);
    });

    it('should read the deprecated sort key', () => {
        const query = parser.parse({ sort: { name: 'DESC' } });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['name', 'DESC']]);
    });
});
