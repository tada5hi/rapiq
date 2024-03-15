/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ParseParametersOptions } from '../parse';
import type { ObjectLiteral } from '../type';

export type SchemaOptions<T extends ObjectLiteral = ObjectLiteral> = {
    defaultPath?: string,
    throwOnFailure?: boolean
} & ParseParametersOptions<T>;
