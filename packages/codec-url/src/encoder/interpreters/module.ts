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
        const output = new Array<string | null>(4);
        if (input.fields) {
            output[0] = this.interpretFields(input.fields);
        }

        if (input.filters) {
            output[1] = this.interpretFilters(input.filters);
        }

        if (input.pagination) {
            output[2] = this.interpretPagination(input.pagination);
        }

        if (input.relations) {
            output[3] = this.interpretRelations(input.relations);
        }

        if (input.sort) {
            output[4] = this.interpretSort(input.sort);
        }

        const normalized = output
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
