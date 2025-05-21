/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { OptionAllowed } from '../../../utils';

export type FieldsOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    mapping?: Record<string, string>,
    allowed?: OptionAllowed<T>,
    default?: OptionAllowed<T>,
    defaultPath?: string,
    throwOnFailure?: boolean,
};
