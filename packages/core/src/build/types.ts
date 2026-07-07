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
 */
export type QueryBuildInput<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    fields?: FieldsBuildInput<RECORD> | IFields,
    filters?: FiltersBuildInput<RECORD> | ICondition,
    pagination?: PaginationBuildInput | IPagination,
    relations?: RelationsBuildInput<RECORD> | IRelations,
    sort?: SortsBuildInput<RECORD> | ISorts,
};
