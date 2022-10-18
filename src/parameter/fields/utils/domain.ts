/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../../../constants';

export function buildFieldDomainRecords(
    data?: Record<string, string[]> | string[],
): Record<string, string[]> {
    if (typeof data === 'undefined') {
        return {};
    }

    let domainFields: Record<string, string[]> = {};

    if (Array.isArray(data)) {
        domainFields[DEFAULT_ID] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}
