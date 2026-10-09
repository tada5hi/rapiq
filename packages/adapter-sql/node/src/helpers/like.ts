/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The escape character of every emitted LIKE condition.
 *
 * Not a backslash: on MySQL `escape '\'` is a syntax error under the
 * default sql_mode, while `escape '\\'` is rejected under
 * NO_BACKSLASH_ESCAPES, so no static backslash spelling parses on both.
 * `!` is never a LIKE metacharacter and was measured equivalent on
 * postgres, mysql (both sql_modes) and sqlite.
 */
export const LIKE_ESCAPE_CHARACTER = '!';

/**
 * Escape LIKE pattern wildcards and the escape character itself, so user
 * input matches literally under `ESCAPE '!'`. Keep the character classes
 * in sync with {@link LIKE_ESCAPE_CHARACTER}.
 *
 * `[` opens a character range on MSSQL only, hence the flag: Oracle
 * rejects an escape character followed by anything but `%`, `_` or
 * itself (ORA-01424), so escaping a bracket there would turn an
 * ordinary value like `[draft]` into a query error.
 */
export function escapeLikePattern(input: string, bracketIsWildcard = false) : string {
    const pattern = bracketIsWildcard ? /[!%_[]/g : /[!%_]/g;

    return input.replace(pattern, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`);
}
