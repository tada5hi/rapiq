/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    SimpleKeys,
} from '../../../types';
import type { OptionAllowed } from '../../../utils';
import type { SortDirection } from './constants';
import type { BaseSchemaOptions } from '../../types';

export type SortOptionDefault<T extends Record<string, any>> = {
    [K in SimpleKeys<T>]?: `${SortDirection}`
};

export type SortOptions<
    T extends Record<string, any> = Record<string, any>,
> = BaseSchemaOptions & {
    allowed?: OptionAllowed<T>,
    mapping?: Record<string, string>,
    default?: SortOptionDefault<T>,
};
