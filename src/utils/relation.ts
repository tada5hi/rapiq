/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { getFieldDetails } from './field';
import { FieldDetails } from './type';
import { DEFAULT_ALIAS_ID } from '../constants';

export function isAllowedByRelations(
    field: string | Pick<FieldDetails, 'alias' | 'path'>,
    includes?: { value: string }[],
    defaultAlias? :string,
) : boolean {
    if (typeof includes === 'undefined') {
        return true;
    }

    const details : Pick<FieldDetails, 'alias' | 'path'> = typeof field === 'string' ?
        getFieldDetails(field) :
        field;

    // check if field is associated to the default domain.
    if (
        typeof details.path === 'undefined' &&
        typeof details.alias === 'undefined'
    ) {
        return true;
    }

    // check if field is associated to the default domain.
    if (
        details.path === defaultAlias ||
        details.alias === defaultAlias ||
        details.alias === DEFAULT_ALIAS_ID
    ) {
        return true;
    }

    return includes.some(
        (include) => include.value === details.path || include.value === details.alias,
    );
}

export function buildFieldWithAlias(
    field: string | Pick<FieldDetails, 'alias' | 'name'>,
    defaultAlias?: string,
) : string {
    const details : Pick<FieldDetails, 'alias' | 'name'> = typeof field === 'string' ?
        getFieldDetails(field) :
        field;

    return defaultAlias || details.alias ?
        `${details.alias || defaultAlias}.${details.name}` :
        details.name;
}
