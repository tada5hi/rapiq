/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { RelationsBuilder } from './module';
import type { RelationsBuildInput } from './types';

export function relations<T extends ObjectLiteral>(
    input?: RelationsBuildInput<T>,
) : RelationsBuilder<T> {
    const clazz = new RelationsBuilder<T>();

    if (input) {
        clazz.addRaw(input);
    }

    return clazz;
}
