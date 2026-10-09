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

/**
 * Whether a dotted field prefix refers to a chain of relations.
 */
export type IsRelationPathFn = (path: string) => boolean;

export function parseField(
    input: string,
    rootAlias?: string,
    relationAlias: RelationAliasFn = buildRelationAlias,
    isRelationPath?: IsRelationPathFn,
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

    if (!isRelationPath) {
        return {
            relation,
            prefix: relationAlias(relation),
            name,
        };
    }

    // walk the dotted prefix from the left: segments only count as a
    // relation path while the backend confirms them — the remainder is
    // the column path (e.g. an embedded column such as `profile.firstName`).
    const segments = input.split('.');

    let boundary = 0;
    while (boundary < segments.length - 1) {
        if (!isRelationPath(segments.slice(0, boundary + 1).join('.'))) {
            break;
        }

        boundary += 1;
    }

    if (boundary === 0) {
        if (rootAlias) {
            return {
                prefix: rootAlias,
                name: input,
            };
        }

        return { name: input };
    }

    const relationPath = segments.slice(0, boundary).join('.');

    return {
        relation: relationPath,
        prefix: relationAlias(relationPath),
        name: segments.slice(boundary).join('.'),
    };
}
