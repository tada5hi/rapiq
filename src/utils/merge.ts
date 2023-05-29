/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createMerger } from 'smob';

export const merge = createMerger({
    clone: true,
    inPlace: false,
    array: true,
    arrayDistinct: true,
});
