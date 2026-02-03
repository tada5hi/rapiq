/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISort } from '../record';
import type { ISorts, ISortsVisitor } from './types';

export class Sorts implements ISorts {
    readonly value: ISort[];

    constructor(value: ISort[] = []) {
        this.value = value;
    }

    accept<R>(visitor: ISortsVisitor<R>) : R {
        return visitor.visitSorts(this);
    }
}
