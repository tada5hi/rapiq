/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Field, FieldOperator, Fields, IFieldVisitor, IFieldsVisitor,
} from 'rapiq';
import type { IFieldsAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type FieldsInterpreterOptions = VisitorOptions;

export class FieldsVisitor implements IFieldsVisitor<IFieldsAdapter>,
IFieldVisitor<IFieldsAdapter> {
    protected adapter: IFieldsAdapter;

    protected options: FieldsInterpreterOptions = {};

    constructor(
        adapter: IFieldsAdapter,
        options: FieldsInterpreterOptions = {},
    ) {
        this.adapter = adapter;
        this.options = options;
    }

    visitField(expr: Field): IFieldsAdapter {
        this.adapter.add(expr.name, expr.operator as FieldOperator);

        return this.adapter;
    }

    visitFields(expr: Fields): IFieldsAdapter {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.adapter;
    }
}
