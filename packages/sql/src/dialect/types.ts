/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type DialectOptions = {
    regexp: (field: string, placeholder: string, ignoreCase: boolean) => string,
    escapeField: (input: string) => string,
    paramPlaceholder: (index: number) => string,
};
