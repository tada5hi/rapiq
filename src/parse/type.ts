/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter, URLParameter } from '../constants';
import type { ObjectLiteral } from '../type';

import type { ParseParameterOptions, ParseParameterOutput } from './parameter';

//------------------------------------------------

export type ParseInput = {
    [K in `${Parameter}` | `${URLParameter}`]?: unknown
};

//------------------------------------------------

export type ParseOptions<T extends ObjectLiteral = ObjectLiteral> = {
    /**
     * On default all query keys are enabled.
     */
    [P in `${Parameter}`]?: boolean | ParseParameterOptions<P, T>
} & {
    defaultPath?: string
};

//------------------------------------------------

export type ParseOutput = {
    [K in `${Parameter}`]?: ParseParameterOutput<K>
} & {
    defaultPath?: string
};
