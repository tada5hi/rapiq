/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Fields } from '../../fields';
import { Filters } from '../../filters';
import { FilterCompoundOperator } from '../../../schema';
import { Sorts } from '../../sorts';
import { Pagination } from '../../pagination';
import type { IRelationVisitor } from './types';

export class Relation {
    readonly name: string;

    readonly fields : Fields;

    readonly filters : Filters;

    readonly pagination : Pagination;

    readonly sort : Sorts;

    constructor(name: string) {
        this.name = name;

        this.fields = new Fields();
        this.filters = new Filters(FilterCompoundOperator.AND, []);
        this.pagination = new Pagination();
        this.sort = new Sorts();
    }

    accept<R>(visitor: IRelationVisitor<R>) : R {
        return visitor.visitRelation(this);
    }
}
