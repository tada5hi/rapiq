/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from './types';

// double-quoted parts are literal text in a to_char pattern. The colons
// are quoted as well: typeorm rewrites every `:<name>` of a caller
// parameter, inside string literals too (`:MI`, `:SS`).
const BUCKET_FORMAT = 'YYYY-MM-DD"T"HH24":"MI":"SS".000Z"';

export const pg : DialectOptions = {
    regexp: (field, placeholder, ignoreCase) => {
        const operator = ignoreCase ? '~*' : '~';
        return `${field} ${operator} ${placeholder}`;
    },
    escapeField: (field: string) => `"${field.replaceAll('"', '""')}"`,
    castText: (input) => `${input}::text`,
    paramPlaceholder: (index) => `$${index}`,
    mod: (field, divisorPlaceholder, remainderPlaceholder) => `mod(${field}, ${divisorPlaceholder}) = ${remainderPlaceholder}`,
    // date_trunc on a timestamptz truncates in the session time zone, so
    // an instant is shifted to UTC wall clock first; a date is widened to
    // a timestamp so every unit yields a timestamp to format.
    bucket: (field, unit, kind) => {
        let input = field;
        if (kind === 'instant') {
            input = `${field} at time zone 'UTC'`;
        } else if (kind === 'date') {
            // cast(), not `::timestamp`, for the same parameter rewrite.
            input = `cast(${field} as timestamp)`;
        }

        return `to_char(date_trunc('${unit}', ${input}), '${BUCKET_FORMAT}')`;
    },
};
