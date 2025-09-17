/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PaginationParseOutput } from 'rapiq';
import type { IPaginationAdapter } from '../adapter';

export class PaginationInterpreter {
    interpret(
        adapter: PaginationParseOutput,
        data: IPaginationAdapter,
    ) {
        data.clear();

        data.setLimit(adapter.limit);
        data.setOffset(adapter.offset);

        data.execute();
    }
}
