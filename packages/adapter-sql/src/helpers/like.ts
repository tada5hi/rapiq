/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Escape LIKE pattern wildcards (incl. the MSSQL bracket range)
 * so user input matches literally under `ESCAPE '\'`.
 */
export function escapeLikePattern(input: string) : string {
    return input.replace(/[\\%_[]/g, (character) => `\\${character}`);
}
