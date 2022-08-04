/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { getFieldDetails } from './field';
import { FieldDetails } from './type';

export function isFieldAllowedByRelations<T extends {
    value: string
}>(
    field: string | FieldDetails,
    includes?: T[],
    options?: {defaultAlias?: string},
) : boolean {
    if (typeof includes === 'undefined') {
        return true;
    }

    options = options ?? {};

    const details : FieldDetails = typeof field === 'string' ? getFieldDetails(field) : field;

    // check if field is associated to the default domain.
    if (
        typeof details.path === 'undefined' &&
        typeof details.alias === 'undefined'
    ) {
        return true;
    }

    // check if field is associated to the default domain.
    if (
        details.path === options.defaultAlias ||
        details.alias === options.defaultAlias
    ) {
        return true;
    }

    return includes.filter(
        (include) => include.value === details.path || include.value === details.alias,
    ).length > 0;
}

export function buildFieldWithAlias(
    field: string | FieldDetails,
    defaultAlias?: string,
) : string {
    const details : FieldDetails = typeof field === 'string' ? getFieldDetails(field) : field;

    if (
        typeof details.path === 'undefined' &&
        typeof details.alias === 'undefined'
    ) {
        // try to use query alias
        return defaultAlias ? `${defaultAlias}.${details.name}` : details.name;
    }

    return `${details.alias}.${details.name}`;
}
