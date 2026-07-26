/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IField,
    IFieldVisitor,
    IFields,
    IFieldsVisitor,
} from '@rapiq/core';
import {
    FieldOperator,
    ITSELF,
    isFilter,
    isFilters,
} from '@rapiq/core';
import type { IFieldsAdapter } from '../adapter';
import type { VisitorOptions } from './types';

export type FieldsInterpreterOptions = VisitorOptions;

/**
 * Collect the leaf fields a condition tree reads. An elemMatch leaf
 * contributes its own field (the array column) and is never descended
 * into: its interior operands are element-relative, not columns.
 */
function collectConditionFields(condition: ICondition, output: string[]) : void {
    if (isFilters(condition)) {
        for (const child of condition.value) {
            collectConditionFields(child, output);
        }

        return;
    }

    if (isFilter(condition)) {
        output.push(condition.field);
    }
}

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

    visitField(expr: IField): IFieldsAdapter {
        this.adapter.add(expr.name, expr.operator as FieldOperator);

        return this.adapter;
    }

    visitFields(expr: IFields): IFieldsAdapter {
        for (const item of expr.value) {
            item.accept(this);
        }

        this.projectConditionOperands(expr);

        return this.adapter;
    }

    /**
     * Force-project the leaf columns a field visibility gate reads
     * (`Field.condition`, rapiq#830). The gate is enforced after the fetch
     * (e.g. by `@rapiq/memory`'s `applyFieldConditions`) against the rows
     * this selection produces; under a sparse fieldset a missing operand
     * would over-redact an eq-style gate and let a negated gate disclose,
     * because negations match missing operands. Operands take the same
     * code path as ordinary columns, so escaping, relation aliasing and
     * auto-joins apply.
     */
    protected projectConditionOperands(expr: IFields) : void {
        // An excluded gated field is never projected, so its gate never
        // fires post-fetch. Without any included gated field there is
        // nothing to do: an empty node selects everything anyway.
        const gated = expr.value.filter(
            (item) => !!item.condition && item.operator !== FieldOperator.EXCLUDE,
        );
        if (gated.length === 0) {
            return;
        }

        const selected = new Set<string>();
        for (const item of expr.value) {
            if (item.operator !== FieldOperator.EXCLUDE) {
                selected.add(item.name);
            }
        }

        for (const item of gated) {
            // A gate is evaluated against the record its field is read
            // from: a gate on `items.secret` has operands relative to the
            // item record, so operand `kind` becomes column `items.kind`.
            const prefix = item.name.split('.');
            prefix.pop();

            const operands : string[] = [];
            collectConditionFields(item.condition as ICondition, operands);

            for (const operand of operands) {
                // ITSELF addresses the record (or bound element) itself,
                // never a projectable column.
                if (operand === ITSELF) {
                    continue;
                }

                const column = [...prefix, operand].join('.');
                if (selected.has(column)) {
                    continue;
                }

                selected.add(column);
                this.adapter.add(column);
            }
        }
    }
}
