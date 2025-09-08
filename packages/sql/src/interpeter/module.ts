/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ParseOutput } from 'rapiq';
import type { Container } from '../container';
import { FieldsInterpreter } from './fields';
import { RelationsInterpreter } from './relations';
import { FiltersInterpreter } from './filters';
import { PaginationInterpreter } from './pagination';

export type InterpreterOptions = {
    rootAlias?: string
};

export class Interpreter {
    protected fields : FieldsInterpreter;

    protected filters : FiltersInterpreter;

    protected relations : RelationsInterpreter;

    protected pagination : PaginationInterpreter;

    // -----------------------------------------------------------

    constructor() {
        this.fields = new FieldsInterpreter();
        this.relations = new RelationsInterpreter();
        this.filters = new FiltersInterpreter();
        this.pagination = new PaginationInterpreter();
    }

    // -----------------------------------------------------------

    interpret(
        input: ParseOutput,
        container: Container,
        options: InterpreterOptions = {},
    ) {
        if (input.relations) {
            this.relations.interpret(
                input.relations,
                container.relations,
                {
                    rootAlias: options.rootAlias,
                },
            );
        }

        if (input.fields) {
            this.fields.interpret(
                input.fields,
                container.fields,
                {
                    rootAlias: options.rootAlias,
                },
            );
        }

        if (input.filters) {
            this.filters.interpret(
                input.filters,
                container.filters,
                {
                    rootAlias: options.rootAlias,
                },
            );
        }

        if (input.pagination) {
            this.pagination.interpret(
                input.pagination,
                container.pagination,
            );
        }

        container.apply(options.rootAlias);
    }
}
