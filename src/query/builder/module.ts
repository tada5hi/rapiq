/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { QueryBuilder } from './builder';
import type { ObjectLiteral } from '../../types';
import type { BuildInput } from './types';

export function buildQuery<T extends ObjectLiteral = ObjectLiteral>(
    input: BuildInput<T> = {},
) : string {
    const builder = new QueryBuilder();
    builder.add(input);

    return builder.toString();
}
