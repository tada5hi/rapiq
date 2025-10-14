/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsBuilder } from './module';
import type { FieldsBuildInput } from './types';
import type { ObjectLiteral } from '../../../types';

export function fields<T extends ObjectLiteral>(
    input?: FieldsBuildInput<T>,
) : FieldsBuilder<T> {
    const clazz = new FieldsBuilder<T>();

    if (input) {
        clazz.addRaw(input);
    }

    return clazz;
}
