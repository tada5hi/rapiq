/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type DialectOptions = {
    /**
     * Build a regular-expression condition.
     * Omit when the dialect has no regexp support — anchored operators
     * (startsWith, endsWith, contains) fall back to LIKE and the
     * regex operator raises a typed AdapterError.
     */
    regexp?: (field: string, placeholder: string, ignoreCase: boolean) => string,
    escapeField: (input: string) => string,
    paramPlaceholder: (index: number) => string,
};
