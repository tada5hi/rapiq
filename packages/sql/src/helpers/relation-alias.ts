/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RelationAliasFn = (path: string) => string;

/**
 * The tightest identifier limit among the shipped dialect presets:
 * PostgreSQL truncates identifiers to 63 bytes (silently, with a
 * NOTICE), so an alias longer than that would lose its uniqueness
 * guarantee on the way into the database.
 */
const MAX_ALIAS_LENGTH = 63;

/**
 * FNV-1a (32 bit) — deterministic, dependency-free disambiguator for
 * aliases that exceed the identifier limit.
 */
function hashPath(input: string) : string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36);
}

/**
 * Default join-alias derivation: every path segment is length-prefixed
 * (e.g. `role.realm` -> `r4_role_5_realm`). Unlike replacing dots with
 * underscores, this is injective even when relation names contain `_`.
 * Aliases that would exceed the database identifier limit are bounded:
 * a readable prefix plus a hash of the full path — otherwise engines
 * such as PostgreSQL would truncate them (silently collapsing long,
 * distinct paths onto one alias).
 */
export function buildRelationAlias(path: string) : string {
    const segments = path.split('.');
    const alias = `r${segments.map((segment) => `${segment.length}_${segment}`).join('_')}`;
    if (alias.length <= MAX_ALIAS_LENGTH) {
        return alias;
    }

    const suffix = `_h${hashPath(path)}`;

    return `${alias.substring(0, MAX_ALIAS_LENGTH - suffix.length)}${suffix}`;
}
