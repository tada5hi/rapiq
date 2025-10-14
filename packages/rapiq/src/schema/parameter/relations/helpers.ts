/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';

export function extractSubRelations(
    relations: Relations | string[],
    root: string,
): string[] {
    if (!Array.isArray(relations)) {
        return extractSubRelations(relations.value.map((relation) => relation.name), root);
    }

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
