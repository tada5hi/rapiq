/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Fields } from '../../../parameter';
import { SimpleFieldsParser } from '../../../parser';
import type { FieldsBuildInput } from './types';
import type { ObjectLiteral } from '../../../types';

export async function fields<T extends ObjectLiteral>(
    input?: FieldsBuildInput<T>,
) : Promise<Fields> {
    const clazz = new SimpleFieldsParser();

    if (input) {
        return clazz.parse(input);
    }

    return new Fields();
}
