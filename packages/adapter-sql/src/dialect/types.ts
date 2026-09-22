/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type DialectOptions = {
    /**
     * Build a regular-expression condition for the `regex` operator.
     * Omit when the dialect has no regexp support: the operator then
     * raises a typed AdapterError. The anchored operators
     * (startsWith, endsWith, contains) always render as LIKE and do
     * not consult this callback.
     */
    regexp?: (field: string, placeholder: string, ignoreCase: boolean) => string,
    /**
     * Build a modulo-equality condition (`field mod divisor = remainder`).
     * Omit when the dialect has no matching syntax: the mod filter
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
    /**
     * Fold an expression for a case-insensitive LIKE comparison
     * (the anchored operators startsWith/endsWith/contains).
     * Omit to reuse `caseFold`. Declare an identity function when the
     * dialect's LIKE is already case-insensitive although its `=` is
     * not (sqlite), so the fold does not defeat the index the pattern
     * prefix could otherwise use.
     */
    caseFoldLike?: (input: string) => string,
    /**
     * Whether `[` opens a character range in the dialect's LIKE patterns
     * and therefore has to be escaped (MSSQL). Leave unset elsewhere:
     * Oracle raises ORA-01424 for an escape character followed by
     * anything but `%`, `_` or itself.
     */
    likeBracketWildcard?: boolean,
    escapeField: (input: string) => string,
    paramPlaceholder: (index: number) => string,
};
