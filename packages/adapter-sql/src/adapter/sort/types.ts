/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from '@rapiq/core';
import type { ISubAdapter } from '../types';







export interface ISortsAdapter extends ISubAdapter {
    add(input: string, value: `${SortDirection}`) : void;
}

/**
 * @deprecated use {@link ISortsAdapter}. Removed in 3.0.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Preserve the public contract.
export type ISortAdapter = ISortsAdapter;

export type SortsContainerOptions = {
    rootAlias?: string,
    escapeField?: (input: string) => string
};

/**
 * @deprecated use {@link SortsContainerOptions}. Removed in 3.0.
 */
export type SortContainerOptions = SortsContainerOptions;
