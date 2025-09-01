/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function isPropertyNameValid(input: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/gu.test(input);
}
