/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RootAliasFn<
    QUERY extends Record<string, any> = Record<string, any>,
> = (query?: QUERY) => string;
