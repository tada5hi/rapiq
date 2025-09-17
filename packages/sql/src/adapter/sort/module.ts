/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapter } from '../relations';
import { SortBaseAdapter } from './base';

export type SortContainerOptions = {
    rootAlias?: string,
    escapeField?: (input: string) => string
};

export class SortAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> extends SortBaseAdapter<QUERY> {
    protected options : SortContainerOptions;

    constructor(
        relations: RelationsAdapter<QUERY>,
        options: SortContainerOptions,
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

    execute() {

    }
}
