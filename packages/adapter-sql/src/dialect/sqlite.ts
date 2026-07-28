/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mysql } from './mysql';
import type { DialectOptions } from './types';

// no regexp: stock SQLite ships without a REGEXP function (it must be
// registered by the application), so anchored operators (startsWith,
// endsWith, contains) fall back to LIKE and the regex operator raises
// a typed AdapterError.
export const sqlite : DialectOptions = {
    paramPlaceholder: mysql.paramPlaceholder,
    escapeField: mysql.escapeField,
};
