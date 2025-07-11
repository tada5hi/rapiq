/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { SortBuilder } from './module';
import type { SortBuildInput } from './types';

export function sort<T extends ObjectLiteral>(
    input?: SortBuildInput<T> | SortBuilder<T>,
) : SortBuilder<T> {
    const clazz = new SortBuilder<T>();

    if (input) {
        clazz.add(input);
    }

    return clazz;
}
