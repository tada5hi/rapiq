/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../../filters';
import type { Field } from './module';

export interface IFieldVisitor<R> {
    visitField(expr: Field): R;
}

export interface IField {
    readonly name: string;

    readonly operator: string | undefined;

    /**
     * Server-side visibility gate: the field is projected, but its value
     * is only visible on rows satisfying this condition. Set by a schema
     * `validate` / `validateMany` hook answering with an `ICondition`;
     * never client-supplied, and never encoded onto the wire.
     *
     * The condition constrains the VALUE of this one field, never the
     * row set: a gated field never removes a row at any level. The SQL
     * backends cannot express that (a selection must stay a bare column
     * for entity hydration), so they project the column unconditionally
     * and the gate is applied after the fetch; `@rapiq/adapter-memory` honours
     * it while projecting.
     */
    readonly condition: ICondition | undefined;

    accept<R>(visitor: IFieldVisitor<R>): R;
}
