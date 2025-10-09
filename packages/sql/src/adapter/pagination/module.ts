/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { PaginationBaseAdapter } from './base';

export class PaginationAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> extends PaginationBaseAdapter<QUERY> {
    execute() {

    }
}
