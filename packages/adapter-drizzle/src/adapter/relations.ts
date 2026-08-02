/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRelations } from '@rapiq/core';

/**
 * Canonical relation paths a query hydrates, parents included and
 * deduplicated, e.g. `['items', 'items.realm']`.
 *
 * Unlike the SQL backends there are no join aliases to derive:
 * drizzle addresses relations positionally through nested `with`
 * entries, so paths are all the selection needs.
 */
export function collectRelationPaths(relations: IRelations) : string[] {
    const output : string[] = [];

    for (const relation of relations.value) {
        const segments = relation.name.split('.');

        for (let i = 0; i < segments.length; i++) {
            const current = segments.slice(0, i + 1).join('.');

            if (!output.includes(current)) {
                output.push(current);
            }
        }
    }

    return output;
}
