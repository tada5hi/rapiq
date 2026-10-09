/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapter } from '../relations';
import { SortsBaseAdapter } from './base';

export type SortsContainerOptions = {
    rootAlias?: string,
    escapeField?: (input: string) => string
};

/**
 * @deprecated use {@link SortsContainerOptions}. Removed in 3.0.
 */
export type SortContainerOptions = SortsContainerOptions;

export class SortsAdapter extends SortsBaseAdapter {
    protected options : SortsContainerOptions;

    constructor(
        relations: RelationsAdapter,
        options: SortsContainerOptions,
    ) {
        super(relations);

        this.options = options;
    }

    escapeField(field: string) : string {
        if (this.options.escapeField) {
            return this.options.escapeField(field);
        }

        return field;
    }

    rootAlias(): string | undefined {
        if (this.options.rootAlias) {
            return this.options.rootAlias;
        }

        return undefined;
    }
}

/**
 * @deprecated use {@link SortsAdapter}. Removed in 3.0.
 */
export const SortAdapter = SortsAdapter;

/**
 * @deprecated use {@link SortsAdapter}. Removed in 3.0.
 */
export type SortAdapter = SortsAdapter;
