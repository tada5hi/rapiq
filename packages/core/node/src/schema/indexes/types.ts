/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral, SimpleKeys } from '../../types';

/**
 * Ordered column lists of the indexes a record's storage declares:
 * own-table flat keys only (a composite index never spans tables),
 * resolved names (after mapping). The declaration is structural: rapiq
 * does not model operator servability (sargability differs per engine),
 * it trusts the author and enforces combinations only.
 */
export type IndexesOption<T extends ObjectLiteral = ObjectLiteral> = SimpleKeys<T>[][];

/**
 * How the filters parameter is checked against the declared indexes:
 * - `anchor`: every AND group must contain at least one conjunct whose
 *   field leads an index (the rest is residual filtering);
 * - `cover`: additionally, per relation path, the AND group's field set
 *   must equal a leftmost prefix of one index.
 */
export type IndexedMode = 'anchor' | 'cover';

/**
 * Answers which indexes govern a relation path (`''` = the parameter
 * root). `null` when the governing schema declares none.
 */
export type IndexesResolver = (path: string) => string[][] | null;

export type IndexCheckSuccess = {
    ok: true,
};

export type IndexCheckFailure = {
    ok: false,
    path: string,
    keys: string[],
};

export type IndexCheckResult = IndexCheckSuccess | IndexCheckFailure;
