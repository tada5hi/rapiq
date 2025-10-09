/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from './types';

export const oracle : DialectOptions = {
    regexp: (field, placeholder, ignoreCase) => {
        const operator = ignoreCase ? '~*' : '~';
        return `${field} ${operator} ${placeholder}`;
    },
    escapeField: (field: string) => `"${field}"`,
    paramPlaceholder: (index) => `$${index}`,
};
