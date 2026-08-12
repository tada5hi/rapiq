/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    SortSchema,
    SortsSchema,
    defineSortSchema,
    defineSortsSchema,
} from '../../../src';

describe('src/schema/parameter/sort/*.ts', () => {
    it('should expose the plural class as canonical', () => {
        expect(defineSortsSchema({ allowed: ['id'] })).toBeInstanceOf(SortsSchema);
    });

    it('should alias the singular class to the plural one', () => {
        expect(SortSchema).toBe(SortsSchema);
    });

    it('should alias the singular factory to the plural one', () => {
        expect(defineSortSchema).toBe(defineSortsSchema);
    });

    it('should build an equivalent schema from either factory', () => {
        expect(defineSortSchema({ allowed: ['id'] }).allowed)
            .toEqual(defineSortsSchema({ allowed: ['id'] }).allowed);
    });
});
