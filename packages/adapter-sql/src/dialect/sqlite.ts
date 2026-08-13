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
    // mod() is a SQLite math function: available since 3.35 and only in
    // builds compiled with SQLITE_ENABLE_MATH_FUNCTIONS. Every mainstream
    // Node driver enables it (better-sqlite3, node:sqlite, sqlite3); on an
    // embedded build without it, override this callback (SQLite's `%` is
    // core syntax but casts both operands to INTEGER, so it only matches
    // the float-capable semantics of @rapiq/adapter-memory for integers)
    // or set it to undefined for the typed filters:mod refusal.
    mod: mysql.mod,
};
