/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import * as interpreters from './module';

export const allInterpreters = {
    ...interpreters,
    in: interpreters.within,
};
