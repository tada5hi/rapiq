/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PaginationParseOutput } from 'rapiq';
import type { PaginationContainer } from '../container';

export class PaginationInterpreter {
    interpret(
        input: PaginationParseOutput,
        data: PaginationContainer,
    ) {
        data.setLimit(input.limit);
        data.setOffset(input.offset);

        data.apply();
    }
}
