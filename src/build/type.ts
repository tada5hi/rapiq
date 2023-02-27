/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter, URLParameter } from '../constants';
import type { BuildParameterInput } from './parameter';

export type BuildInput<
    T extends Record<string, any>,
> = {
    [P in `${Parameter}` | `${URLParameter}`]?: BuildParameterInput<P, T>
};
