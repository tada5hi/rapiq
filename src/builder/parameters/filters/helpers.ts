/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty, isObject } from '../../../utils';
import type { FiltersBuildCompoundInput } from './types';

export function isFiltersBuildCompoundInput<
    T extends Record<PropertyKey, any>,
>(input: unknown) : input is FiltersBuildCompoundInput<T> {
    if (!isObject(input)) {
        return false;
    }

    return hasOwnProperty(input, 'value') &&
        hasOwnProperty(input, 'operator');
}
