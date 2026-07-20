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

export abstract class FieldsBaseAdapter implements IFieldsAdapter {
    protected relations: RelationsBaseAdapter;

    /**
     * selection fields.
     *
     * e.g. ['name', 'project.id']
     */
    protected value : { name: string, operator?: `${FieldOperator}` }[];

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter,
    ) {
        this.relations = relations;
        this.value = [];
    }

    // -----------------------------------------------------------

    clear() {
        this.value = [];
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract escapeField(field: string) : string;

    /**
     * Apply the accumulated state to a backend target.
     * Fragment-emitting backends have nothing to apply.
     */
    execute() : void {}

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

        const output = parseField(
            input,
            rootAlias,
            (path) => this.relations.buildAlias(path),
            (path) => this.relations.isRelationPath(path),
        );
        if (output.relation) {
            this.relations.add(output.relation);
        }

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(output.name)}`;
        }

        return this.escapeField(output.name);
    }
}
