/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { AggregatesSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';

/**
 * No failure-policy options: every aggregates rejection is fatal.
 */
export type AggregatesParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    schema?: string | Schema<RECORD> | AggregatesSchema<RECORD>,
};
