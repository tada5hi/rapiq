/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { splitLast } from './name-split';
import type { RelationAliasFn } from './relation-alias';
import { buildRelationAlias } from './relation-alias';

type Field = {
    prefix?: string,
    relation?: string,
    name: string
};

export function parseField(
    input: string,
    rootAlias?: string,
    relationAlias: RelationAliasFn = buildRelationAlias,
) : Field {
    const [relation, name] = splitLast(input);
    if (!name) {
        if (rootAlias) {
            return {
                prefix: rootAlias,
                name: relation,
            };
        }

        return { name: relation };
    }

    return {
        relation,
        prefix: relationAlias(relation),
        name,
    };
}
