/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Schema } from './module';
import type { SchemaOptions } from './types';
import type { ObjectLiteral } from '../types';

export function defineSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(options: SchemaOptions<RECORD> = {}) : Schema<RECORD> {
    return new Schema(options);
}
