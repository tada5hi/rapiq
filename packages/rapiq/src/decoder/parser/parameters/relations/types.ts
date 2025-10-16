/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../../types';
import type { RelationsSchema, Schema } from '../../../../schema';

export type RelationsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    throwOnFailure?: boolean,
    schema?: string | Schema<RECORD> | RelationsSchema<RECORD>
};
