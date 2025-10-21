/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Pagination } from 'rapiq';
import type { IPaginationAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type PaginationInterpreterOptions = InterpreterInterpretOptions;

export class PaginationInterpreter {
    interpret(
        input: Pagination,
        adapter: IPaginationAdapter,
        options: PaginationInterpreterOptions = {},
    ) {
        adapter.clear();

        adapter.setLimit(input.limit);
        adapter.setOffset(input.offset);

        const execute = options.execute ?? true;
        if (execute) {
            adapter.execute();
        }
    }
}
