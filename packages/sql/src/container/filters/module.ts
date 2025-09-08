/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '../../dialect';
import type { RelationsContainer } from '../relations/module';
import { FiltersAbstractContainer } from './base';

export type FiltersContainerOptions = {
    rootAlias?: string,
} & DialectOptions;

export class FiltersContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> extends FiltersAbstractContainer<QUERY> {
    protected options: FiltersContainerOptions;

    // -----------------------------------------------------------

    constructor(
        relations: RelationsContainer<QUERY>,
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
        const child = new FiltersContainer<QUERY>(
            this.relations,
            this.options,
        );

        this.setChildAttributes(child);

        return child as this;
    }
}
