/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IFields,
    IPagination,
    IRelations,
    ISorts,
} from '../parameter';
import type { ObjectLiteral } from '../types';
import type {
    FieldsBuildInput,
    FiltersBuildInput,
    PaginationBuildInput,
    RelationsBuildInput,
    SortsBuildInput,
} from './parameter';

/**
 * Keys are the canonical {@link Parameter} names. Every parameter accepts
 * either raw build input or an already-built AST fragment (the define*
 * factories return the latter), so fragments assign without casts.
 *
 * DEPTH bounds the recursive per-parameter input types (default 5, like
 * the per-parameter Build*Input types). Lower it for self-recursive
 * record types whose inferred input type would otherwise grow too large.
 */
export type QueryBuildInput<
    RECORD extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 5,
> = {
    fields?: FieldsBuildInput<RECORD, DEPTH> | IFields,
    filters?: FiltersBuildInput<RECORD, DEPTH> | ICondition,
    pagination?: PaginationBuildInput | IPagination,
    relations?: RelationsBuildInput<RECORD, DEPTH> | IRelations,
    sort?: SortsBuildInput<RECORD, DEPTH> | ISorts,
};
