/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RelationAliasFn = (path: string) => string;

/**
 * Default join-alias derivation: the full relation path with `.`
 * replaced by `_` (e.g. `role.realm` -> `role_realm`), so relation
 * paths ending in the same segment never share an alias.
 */
export function buildRelationAlias(path: string) : string {
    return path.replace(/\./g, '_');
}
