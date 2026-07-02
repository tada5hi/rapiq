/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../constants';
import type { ParseError } from '../../errors';
import type { IRelations } from '../../parameter';
import type { ObjectLiteral } from '../../types';
import type {
    FieldsSchema,
    FiltersSchema,
    PaginationSchema,
    RelationsSchema,
    SortSchema,
} from '../parameter';
import type { KeyResolutionErrorCode } from './constants';
import type { ResolutionScope } from './module';

export type ParameterSchema<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
> = P extends `${Parameter.FIELDS}` ?
    FieldsSchema<RECORD> :
    P extends `${Parameter.FILTERS}` ?
        FiltersSchema<RECORD> :
        P extends `${Parameter.PAGINATION}` ?
            PaginationSchema :
            P extends `${Parameter.RELATIONS}` ?
                RelationsSchema<RECORD> :
                P extends `${Parameter.SORT}` ?
                    SortSchema<RECORD> :
                    never;

export type KeyResolutionOk<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    ok: true,
    /**
     * Canonical (alias-resolved) leaf field name.
     */
    name: string,
    /**
     * Canonical relation path segments; empty for own attributes.
     */
    path: string[],
    /**
     * Scope governing the leaf: `this` for local keys,
     * a descendant scope for dotted keys.
     */
    scope: ResolutionScope<P, RECORD>,
};

export type KeyResolutionFailed = {
    ok: false,
    code: KeyResolutionErrorCode,
    /**
     * Raw input key.
     */
    input: string,
    /**
     * Canonical offending token (path segment or leaf name).
     */
    segment?: string,
};

export type KeyResolution<
    P extends `${Parameter}`,
    RECORD extends ObjectLiteral = ObjectLiteral,
> = KeyResolutionOk<P, RECORD> | KeyResolutionFailed;

export type ResolutionScopeContext = {
    /**
     * Parsed relations governing which relation segments may be entered.
     */
    relations?: IRelations,
    /**
     * Failure-policy override: takes precedence over the schema-level setting.
     */
    throwOnFailure?: boolean,
    /**
     * Error class used when throwing; defaults to the parameter's ParseError subclass.
     */
    errors?: typeof ParseError,
};
