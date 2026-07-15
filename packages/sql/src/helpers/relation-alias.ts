/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RelationAliasFn = (path: string) => string;

/**
 * Default join-alias derivation: every path segment is length-prefixed
 * (e.g. `role.realm` -> `r4_role_5_realm`). Unlike replacing dots with
 * underscores, this is injective even when relation names contain `_`.
 */
export function buildRelationAlias(path: string) : string {
    const segments = path.split('.');
    return `r${segments.map((segment) => `${segment.length}_${segment}`).join('_')}`;
}
