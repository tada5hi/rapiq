/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export function extractSubRelations(
    relations: string[],
    root: string,
): string[] {
    const removed : string[] = [];
    for (let i = relations.length - 1; i >= 0; i--) {
        if (relations[i] === root) {
            relations.splice(i, 1);
            continue;
        }

        if (relations[i].substring(0, root.length) === root) {
            removed.push(relations[i].substring(root.length + 1));
            relations.splice(i, 1);
        }
    }

    return removed;
}
