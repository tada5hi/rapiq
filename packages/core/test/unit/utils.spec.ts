/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { applyMapping } from '../../src/utils';

describe('src/utils/*.ts', () => {
    it('should get name by alias', () => {
        let data = applyMapping('a.b.c', {
            a: 'p',
            'b.c': 'a',
        });
        expect(data).toEqual('p.a');

        data = applyMapping('a.b.c', {
            a: 'p',
            c: 'a',
        });
        expect(data).toEqual('p.b.a');

        data = applyMapping('a.b.c.d.e', {
            a: 'z',
            'c.d': 'y',
        });
        expect(data).toEqual('z.b.y.e');
    });
});
