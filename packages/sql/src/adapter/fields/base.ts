/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldOperator } from '@rapiq/core';
import { parseField } from '../../helpers';
import type { RelationsBaseAdapter } from '../relations';
import type { IFieldsAdapter } from './types';

export abstract class FieldsBaseAdapter<
    TARGET extends Record<string, any> = Record<string, any>,
> implements IFieldsAdapter<TARGET> {
    protected relations: RelationsBaseAdapter<TARGET>;

    /**
     * selection fields.
     *
     * e.g. ['name', 'project.id']
     */
    protected value : { name: string, operator?: `${FieldOperator}` }[];

    protected target : TARGET | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter<TARGET>,
    ) {
        this.relations = relations;
        this.value = [];
    }

    // -----------------------------------------------------------

    setTarget(target?: TARGET) {
        this.target = target;
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

    /**
     * Escaped selection columns (excluded fields are dropped).
     */
    getColumns() : string[] {
        const output : string[] = [];

        for (let i = 0; i < this.value.length; i++) {
            const element = this.value[i] as { name: string, operator?: `${FieldOperator}` };
            if (element.operator === FieldOperator.EXCLUDE) {
                continue;
            }

            output.push(element.name);
        }

        return output;
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
