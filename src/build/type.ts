/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../type';
import type { BuildParametersInput, BuildURLParametersInput } from './parameter';

export type BuildInput<
    T extends ObjectLiteral,
> = BuildParametersInput<T> & BuildURLParametersInput<T>;
