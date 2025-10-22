/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral, Query } from 'rapiq';

export interface IEncoder<
    OUTPUT = any,
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> {
    encode(input: Query, options?: Partial<OPTIONS>) : OUTPUT
}
