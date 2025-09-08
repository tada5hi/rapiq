/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from './types';

export const mssql : DialectOptions = {
    regexp() {
        throw new Error('"regexp" operator is not supported in MSSQL');
    },
    paramPlaceholder: () => '?',
    escapeField: (field: string) => `[${field}]`,
};
