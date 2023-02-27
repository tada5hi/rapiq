/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from '../parameter';
import { getFieldDetails } from './field';
import type { FieldDetails } from './type';

export function isFieldNonRelational(field: string | FieldDetails) {
    const details = typeof field === 'string' ?
        getFieldDetails(field) :
        field;

    return typeof details.path === 'undefined';
}

export function isFieldPathAllowedByRelations(
    field: string | Pick<FieldDetails, 'path'>,
    includes?: RelationsParseOutput,
) : boolean {
    if (typeof includes === 'undefined') {
        return true;
    }

    const details : Pick<FieldDetails, 'path'> = typeof field === 'string' ?
        getFieldDetails(field) :
        field;

    if (
        typeof details.path === 'undefined'
    ) {
        return true;
    }

    return includes.some(
        (include) => include.key === details.path,
    );
}

export function buildFieldWithPath(
    field: string | FieldDetails,
    path?: string,
) : string {
    const details = typeof field === 'string' ?
        getFieldDetails(field) :
        field;

    return details.path || path ?
        `${details.path || path}.${details.name}` :
        details.name;
}
