/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IField } from '../record';

export interface IFieldsVisitor<R> {
    visitFields(expr: IFields): R;
}

export interface IFields {
    readonly value: IField[]

    accept<R>(visitor: IFieldsVisitor<R>): R;
}
