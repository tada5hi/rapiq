/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Condition,
    Fields,
    IInterpreter,
    Pagination,
    Query,
    Relations, Sort, Sorts,
} from 'rapiq';
import { FieldsInterpreter } from './fields';
import { FiltersInterpreter } from './filters';
import { PaginationInterpreter } from './pagination';
import { RelationsInterpreter } from './relations';
import { SortsInterpreter } from './sort';

export class Interpreter implements IInterpreter<Query, string> {
    protected fields: FieldsInterpreter;

    protected filters : FiltersInterpreter;

    protected pagination : PaginationInterpreter;

    protected relations: RelationsInterpreter;

    protected sort : SortsInterpreter;

    constructor() {
        this.fields = new FieldsInterpreter();
        this.filters = new FiltersInterpreter();
        this.pagination = new PaginationInterpreter();
        this.relations = new RelationsInterpreter();
        this.sort = new SortsInterpreter();
    }

    interpret(input: Query): string {
        const normalized = [
            input.fields && this.interpretFields(input.fields),
            input.filters && this.interpretFilters(input.filters),
            input.pagination && this.interpretPagination(input.pagination),
            input.relations && this.interpretRelations(input.relations),
            input.sort && this.interpretSort(input.sort),
        ]
            .filter(Boolean)
            .join('&');

        return normalized.length > 0 ?
            `?${normalized}` :
            '';
    }

    interpretFields(input: Fields) : string | null {
        return this.fields.interpret(input);
    }

    interpretFilters(input: Condition) : string | null {
        return this.filters.interpret(input);
    }

    interpretPagination(input: Pagination) : string | null {
        return this.pagination.interpret(input);
    }

    interpretRelations(input: Relations) : string | null {
        return this.relations.interpret(input);
    }

    interpretSort(input: Sorts | Sort) : string | null {
        return this.sort.interpret(input);
    }
}
