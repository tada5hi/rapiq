/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsContainer } from '../relations';
import { AbstractFieldsContainer } from './base';

export type FieldsContainerOptions = {
    rootAlias?: string,
    escapeField?: (input: string) => string
};

export class FieldsContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> extends AbstractFieldsContainer<QUERY> {
    protected options : FieldsContainerOptions;

    constructor(
        relations: RelationsContainer<QUERY>,
        options: FieldsContainerOptions,
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
