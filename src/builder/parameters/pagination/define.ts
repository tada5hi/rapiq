/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBuilder } from './module';
import type { PaginationBuildInput } from './types';

export function pagination(
    input?: PaginationBuildInput | PaginationBuilder,
) : PaginationBuilder {
    const clazz = new PaginationBuilder();

    if (input) {
        clazz.addRaw(input);
    }

    return clazz;
}
