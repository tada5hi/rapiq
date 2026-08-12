/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';
import { BuildError } from '../errors';
import type { QueryContext } from '../parameter';
import { Query } from '../parameter';
import type { ObjectLiteral } from '../types';
import { assertKnownInputKeys } from '../utils';
import {
    defineFields,
    defineFilters,
    definePagination,
    defineRelations,
    defineSorts,
} from './parameter';
import type { QueryBuildInput } from './types';

const BUILD_INPUT_KEYS : string[] = [
    Parameter.FIELDS,
    Parameter.FILTERS,
    Parameter.PAGINATION,
    Parameter.RELATIONS,
    Parameter.SORT,
];

/**
 * Build a {@link Query} (the IR) directly from typed input — no string
 * round-trip, no parsing, no schema. Validation against a schema happens
 * server-side after transport.
 */
export function defineQuery(input?: QueryBuildInput<ObjectLiteral>) : Query;
export function defineQuery<
    RECORD extends ObjectLiteral,
    DEPTH extends number = 5,
>(input?: QueryBuildInput<RECORD, DEPTH>) : Query;
export function defineQuery(input: QueryBuildInput<ObjectLiteral> = {}) : Query {
    assertKnownInputKeys(
        input,
        BUILD_INPUT_KEYS,
        (key, suggestion) => BuildError.keyUnknown(key, suggestion),
    );

    const context : QueryContext = {};

    if (typeof input.fields !== 'undefined') {
        context.fields = defineFields(input.fields);
    }

    if (typeof input.filters !== 'undefined') {
        context.filters = defineFilters(input.filters);
    }

    if (typeof input.pagination !== 'undefined') {
        context.pagination = definePagination(input.pagination);
    }

    if (typeof input.relations !== 'undefined') {
        context.relations = defineRelations(input.relations);
    }

    if (typeof input.sort !== 'undefined') {
        context.sorts = defineSorts(input.sort);
    }

    return new Query(context);
}
