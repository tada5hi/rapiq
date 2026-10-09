/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ProviderOptions = {
    /**
     * Whether the connector renders `ilike`/`notIlike` (the postgres
     * `ILIKE` keyword). The rapiq case contract (eq/ne/in/nin and the
     * anchored operators compare case-insensitively by default) is
     * expressed through those operators where they exist.
     *
     * Connectors whose default collation already compares
     * case-insensitively (mysql) or whose `LIKE` is ASCII-folding
     * (sqlite) set this to `false`: exactly like the identity
     * `caseFold` of the `@rapiq/adapter-sql` mysql dialect.
     */
    caseInsensitiveLike: boolean,

    /**
     * Whether the connector's `LIKE` treats a backslash as the
     * default escape character. Drizzle's object filters accept no
     * `ESCAPE` clause, so on a connector without a default escape
     * (sqlite) a pattern operand containing `%` or `_` cannot be
     * matched literally: the adapter fails typed instead of silently
     * widening the match.
     */
    likeEscape: boolean,
};
