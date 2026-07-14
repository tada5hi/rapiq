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
    /**
     * Fold an expression (field or parameter placeholder) for a
     * case-insensitive equality comparison (eq/ne/in/nin on strings).
     * Omit for the default `lower(...)` wrapping — dialects whose plain
     * `=` already compares case-insensitively under their default
     * collation (mysql, mssql) return the input unchanged instead.
     */
    caseFold?: (input: string) => string,
    escapeField: (input: string) => string,
    paramPlaceholder: (index: number) => string,
};
