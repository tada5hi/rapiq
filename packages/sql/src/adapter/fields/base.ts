/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from 'rapiq';
import { parseField } from '../../helpers';
import type { RelationsBaseAdapter } from '../relations';
import type { IFieldsAdapter } from './types';

export abstract class FieldsBaseAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements IFieldsAdapter {
    protected relations: RelationsBaseAdapter<QUERY>;

    /**
     * selection fields.
     *
     * e.g. ['name', 'project.id']
     */
    protected value : { name: string, operator?: `${FieldOperator}` }[];

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter<QUERY>,
    ) {
        this.relations = relations;
        this.value = [];
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    clear() {
        this.value = [];
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract escapeField(field: string) : string;

    abstract execute() : void;

    // -----------------------------------------------------------

    add(input: string, operator?: `${FieldOperator}`) {
        const name = this.buildField(input);

        this.value.push({ name, operator });
    }

    buildField(input: string) {
        const rootAlias = this.rootAlias();

        const output = parseField(input, rootAlias);
        if (output.relation) {
            this.relations.add(output.relation);
        }

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(output.name)}`;
        }

        return this.escapeField(output.name);
    }
}
