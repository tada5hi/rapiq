/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../type';
import { Schema } from './module';
import type { SchemaOptions } from './types';

export function defineSchema<T extends ObjectLiteral = ObjectLiteral>(
    options: SchemaOptions<T>,
) : Schema<T> {
    return new Schema<T>(options);
}
