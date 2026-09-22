/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BUCKET_FORMATS } from './bucket';
import type { DialectOptions } from './types';

export const mysql : DialectOptions = {
    regexp: (field, placeholder) => `${field} regexp ${placeholder} = 1`,
    paramPlaceholder: () => '?',
    escapeField: (field: string) => `\`${field.replaceAll('`', '``')}\``,
    // mysql's default collations (*_ci) already compare `=` case-
    // insensitively; skip lower() so plain indexes stay usable.
    // Override with a lower()-wrapping caseFold when columns use
    // *_bin / *_cs collations.
    caseFold: (input) => input,
    mod: (field, divisorPlaceholder, remainderPlaceholder) => `mod(${field}, ${divisorPlaceholder}) = ${remainderPlaceholder}`,
    // formats the stored value as is: a TIMESTAMP column is converted to
    // the session time_zone on read, so it buckets in UTC only under a
    // UTC session.
    bucket: (field, unit) => `date_format(${field}, '${BUCKET_FORMATS[unit]}')`,
};
