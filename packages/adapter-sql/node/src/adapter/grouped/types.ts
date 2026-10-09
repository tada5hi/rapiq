/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from '@rapiq/core';

export type GroupedSelect = {
    /** Output key: the row key and the select alias. */
    key: string,
    /** Rendered SQL expression. */
    expression: string,
};

export type GroupedClauses = {
    /** Groups first, then aggregates, in IR order. */
    selects: GroupedSelect[],
    /**
     * Group expressions repeated verbatim, never their aliases (mssql
     * and oracle reject an alias in GROUP BY); [] without groups.
     */
    groupBy: string[],
    /** Output keys to order by, from `resolveGroupedSorts`. */
    orderBy: { key: string, direction: `${SortDirection}` }[],
};
