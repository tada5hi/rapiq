/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IInterpreter, Pagination } from 'rapiq';

import { URLParameter } from '../../constants';
import { serializeAsURI } from '../../utils';

export class PaginationInterpreter implements IInterpreter<Pagination, string | null> {
    interpret(input: Pagination): string | null {
        if (
            typeof input.limit === 'undefined' &&
            typeof input.offset === 'undefined'
        ) {
            return null;
        }

        return serializeAsURI(
            {
                limit: input.limit,
                offset: input.offset,
            },
            {
                prefixParts: [URLParameter.PAGINATION],
            },
        );
    }
}
