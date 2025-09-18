/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ParseOutput } from 'rapiq';
import type { IRootAdapter } from '../adapter';
import { FieldsInterpreter } from './fields';
import { RelationsInterpreter } from './relations';
import type { FiltersInterpreterOptions } from './filters';
import { FiltersInterpreter } from './filters';
import { PaginationInterpreter } from './pagination';
import type { InterpreterInterpretOptions } from './types';

export type InterpreterOptions = {
    filters?: FiltersInterpreterOptions
};

export class Interpreter {
    protected fields : FieldsInterpreter;

    protected filters : FiltersInterpreter;

    protected relations : RelationsInterpreter;

    protected pagination : PaginationInterpreter;

    // -----------------------------------------------------------

    constructor(options: InterpreterOptions = {}) {
        this.fields = new FieldsInterpreter();
        this.relations = new RelationsInterpreter();
        this.filters = new FiltersInterpreter(options.filters);
        this.pagination = new PaginationInterpreter();
    }

    // -----------------------------------------------------------

    interpret(
        input: ParseOutput,
        container: IRootAdapter,
        options: InterpreterInterpretOptions = {},
    ) {
        if (input.relations) {
            this.relations.interpret(
                input.relations,
                container.relations,
                {
                    ...options,
                    execute: false,
                },
            );
        }

        if (input.fields) {
            this.fields.interpret(
                input.fields,
                container.fields,
                {
                    ...options,
                    execute: false,
                },
            );
        }

        if (input.filters) {
            this.filters.interpret(
                input.filters,
                container.filters,
                {
                    ...options,
                    execute: false,
                },
            );
        }

        if (input.pagination) {
            this.pagination.interpret(
                input.pagination,
                container.pagination,
                {
                    ...options,
                    execute: false,
                },
            );
        }

        container.execute(options.rootAlias);
    }
}
