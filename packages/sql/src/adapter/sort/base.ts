/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from 'rapiq';
import { parseField } from '../../helpers';
import type { RelationsBaseAdapter } from '../relations';
import type { ISortAdapter } from './types';

export abstract class SortBaseAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements ISortAdapter<QUERY> {
    protected relations: RelationsBaseAdapter<QUERY>;

    protected value : Record<string, `${SortDirection}`>;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter<QUERY>,
    ) {
        this.relations = relations;
        this.value = {};
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    clear() {
        this.value = {};
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract escapeField(field: string) : string;

    abstract execute() : void;

    // -----------------------------------------------------------

    add(input: string, value: `${SortDirection}`, rootAlias?: string) {
        const name = this.normalizeField(input, rootAlias);

        this.value[name] = value;
    }

    protected normalizeField(input: string, rootAlias?: string) {
        const output = parseField(input, rootAlias || this.rootAlias());
        if (output.relation) {
            this.relations.add(output.relation);
        }

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(output.name)}`;
        }

        return this.escapeField(output.name);
    }
}
