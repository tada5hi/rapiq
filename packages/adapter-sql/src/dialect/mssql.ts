/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from './types';

// no regexp support: the regex operator raises a typed AdapterError.
export const mssql : DialectOptions = {
    // `[` opens a character range in T-SQL LIKE patterns.
    likeBracketWildcard: true,
    paramPlaceholder: () => '?',
    escapeField: (field: string) => `[${field.replaceAll(']', ']]')}]`,
    // sql server's default collations (*_CI_*) already compare `=`
    // case-insensitively; skip lower() so plain indexes stay usable.
    // Override with a lower()-wrapping caseFold when columns use
    // *_CS_* / *_BIN collations.
    caseFold: (input) => input,
    // SQL Server has no MOD() function; the modulo operator is `%`.
    mod: (field, divisorPlaceholder, remainderPlaceholder) => `${field} % ${divisorPlaceholder} = ${remainderPlaceholder}`,
};
