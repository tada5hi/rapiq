/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAdapter } from '../types';

export interface IPaginationAdapter<
QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
    setLimit(limit?: number): void;
    setOffset(offset?: number) : void
}
