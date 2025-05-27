/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function escapeRegExp(input: string) : string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
