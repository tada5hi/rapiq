/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from '@rapiq/core';
import type { ISubAdapter } from '../types';

export type FieldAddOptions = {
    /**
     * The column is force-projected as a visibility-gate operand
     * (rapiq#830), not picked by the client. Operands never narrow an
     * `include`d relation to a sparse selection (#847): behind a
     * fully-selected relation the join already covers them.
     */
    operand?: boolean,
};

export interface IFieldsAdapter extends ISubAdapter {
    add(input: string, operator?: `${FieldOperator}`, options?: FieldAddOptions): void;
}
