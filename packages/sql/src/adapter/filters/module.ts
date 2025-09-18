/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '../../dialect';
import type { RelationsAdapter } from '../relations';
import { FiltersBaseAdapter } from './base';

export type FiltersContainerOptions = {
    rootAlias?: string,
} & DialectOptions;

export class FiltersAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> extends FiltersBaseAdapter<QUERY> {
    protected options: FiltersContainerOptions;

    // -----------------------------------------------------------

    constructor(
        relations: RelationsAdapter<QUERY>,
        options: FiltersContainerOptions,
    ) {
        super(relations);
        this.options = options;
    }

    // -----------------------------------------------------------

    rootAlias() : string | undefined {
        return this.options.rootAlias;
    }

    paramPlaceholder(index: number) {
        return this.options.paramPlaceholder(index);
    }

    escapeField(field: string) : string {
        return this.options.escapeField(field);
    }

    regexp(field: string, placeholder: string, ignoreCase: boolean) : string {
        return this.options.regexp(field, placeholder, ignoreCase);
    }

    // -----------------------------------------------------------

    child() : this {
        const child = new FiltersAdapter<QUERY>(
            this.relations as unknown as RelationsAdapter<QUERY>,
            this.options,
        );

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {

    }
}
