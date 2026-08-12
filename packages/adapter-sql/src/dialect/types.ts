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
     * Build a modulo-equality condition (`field mod divisor = remainder`).
     * Omit when the dialect has no matching syntax — the mod filter
     * operator then raises a typed AdapterError (`filters:mod`), exactly
     * like an omitted `regexp`. No single spelling works everywhere
     * (Oracle's `MOD()` function versus SQL Server's `%` operator), hence
     * a dialect slot rather than a hardcoded default.
     */
    mod?: (field: string, divisorPlaceholder: string, remainderPlaceholder: string) => string,
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
