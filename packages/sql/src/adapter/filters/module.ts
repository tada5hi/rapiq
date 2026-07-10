/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '@rapiq/core';
import type { DialectOptions } from '../../dialect';
import type { RelationsAdapter } from '../relations';
import { FiltersBaseAdapter } from './base';

export type FiltersContainerOptions = {
    rootAlias?: string,
} & DialectOptions;

export class FiltersAdapter extends FiltersBaseAdapter {
    protected options: FiltersContainerOptions;

    // -----------------------------------------------------------

    constructor(
        relations: RelationsAdapter,
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

    override isRegexpSupported() : boolean {
        return typeof this.options.regexp !== 'undefined';
    }

    regexp(field: string, placeholder: string, ignoreCase: boolean) : string {
        if (!this.options.regexp) {
            throw AdapterError.featureUnsupported('regexp');
        }

        return this.options.regexp(field, placeholder, ignoreCase);
    }

    // -----------------------------------------------------------

    child() : this {
        const child = new FiltersAdapter(
            this.relations as unknown as RelationsAdapter,
            this.options,
        );

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {

    }
}
