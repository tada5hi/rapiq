/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAdapter } from '../types';

export interface IRelationsAdapter<
QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
    add(input: string, rootAlias?: string): void;
}
