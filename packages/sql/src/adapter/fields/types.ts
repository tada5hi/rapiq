/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldOperator } from '@rapiq/core';
import type { IAdapter } from '../types';

export interface IFieldsAdapter<
QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
    add(input: string, operator?: `${FieldOperator}`): void;
}
