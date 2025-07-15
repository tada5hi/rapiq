/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { pagination } from '../../../src';

describe('src/builder/pagination', () => {
    it('should build with simple limit input', () => {
        const data = pagination({
            limit: 10,
        });

        expect(data.value).toEqual({
            limit: 10,
        });
    });

    it('should build with simple offset input', () => {
        const data = pagination({
            offset: 0,
        });

        expect(data.value).toEqual({
            offset: 0,
        });
    });

    it('should build with multiple operations', () => {
        const data = pagination();
        data.setLimit(50);
        data.setOffset(0);

        expect(data.value).toEqual({
            limit: 50,
            offset: 0,
        });
    });
});
