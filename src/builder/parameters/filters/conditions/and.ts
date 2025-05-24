/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterCompoundOperator } from '../../../../schema';
import type { ObjectLiteral } from '../../../../types';
import { FilterBuildCompound } from './compound';

export class FilterBuildAnd<T extends ObjectLiteral = ObjectLiteral> extends FilterBuildCompound<T> {
    constructor(conditions: T[]) {
        super(FilterCompoundOperator.AND, conditions);
    }
}
