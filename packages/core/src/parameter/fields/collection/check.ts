/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IFields, IFieldsVisitor } from './types';

/**
 * A `Fields` collection is identified by its visitor dispatch: accept()
 * of a fields node calls visitFields and nothing else. Works across
 * package instances, where instanceof fails, and distinguishes the
 * structurally identical collection nodes (Fields, Sorts, ...).
 */
export function isFields(input: unknown) : input is IFields {
    return dispatchesTo<IFieldsVisitor<unknown>>(input, 'visitFields');
}

/**
 * Whether any field of the selection carries a visibility condition
 * (see `IField.condition`). The gate is only applied while projecting
 * by `@rapiq/memory`; the SQL backends fetch the column for every row
 * and rely on the consumer running the fetched rows through
 * `applyFieldConditions` before serializing them. This is the check a
 * response path can assert on to guarantee no gated column ships
 * unredacted.
 */
export function hasFieldConditions(input: IFields | { fields: IFields }) : boolean {
    const fields = isFields(input) ? input : input.fields;

    return fields.value.some(
        (field) => typeof field.condition !== 'undefined',
    );
}
