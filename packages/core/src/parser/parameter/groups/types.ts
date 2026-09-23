/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { GroupsSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';

/**
 * No failure-policy options: every groups rejection is fatal.
 */
export type GroupsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    schema?: string | Schema<RECORD> | GroupsSchema<RECORD>,
};
