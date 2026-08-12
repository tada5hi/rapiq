/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Schema } from '../module';
import type { ObjectLiteral } from '../../types';

/**
 * A schema as held by a {@link SchemaRegistry}. Registration refuses a
 * schema without a name, so `name` is a `string` for everything read
 * back out of a registry, and a consumer keying a lookup off it needs no
 * assertion. The guarantee covers registration, not later mutation: the
 * name stays settable, and setting it to `undefined` does not retract
 * the entry.
 */
export type RegisteredSchema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = Schema<RECORD, CONTEXT> & { name: string };
