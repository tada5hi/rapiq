/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../constants';
import { BuildParameterInput } from './parameter';

export type BuildOptions = {
    // empty type for now :)
};

export type BuildInput<
    V extends Record<string, any>,
> = {
    [K in `${Parameter}` | `${URLParameter}`]?: BuildParameterInput<K, V>
};
