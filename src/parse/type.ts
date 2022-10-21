/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../constants';
import { ObjectLiteral } from '../type';

import { ParseParameterOptions, ParseParameterOutput } from './parameter';

//------------------------------------------------

export type ParseInput = {
    [K in `${Parameter}` | `${URLParameter}`]?: any
};

//------------------------------------------------

export type ParseOptions<T extends ObjectLiteral = ObjectLiteral> = {
    /**
     * On default all query keys are enabled.
     */
    [P in `${Parameter}`]?: ParseParameterOptions<P, T>
} & {
    defaultPath?: string
};

//------------------------------------------------

export type ParseOutput = {
    [K in `${Parameter}`]?: ParseParameterOutput<K>
} & {
    defaultPath?: string
};
