/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mysql } from './mysql';
import type { DialectOptions } from './types';

export const sqlite : DialectOptions = {
    ...mysql,
};
