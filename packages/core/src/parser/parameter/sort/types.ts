/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';
import type { Schema, SortsSchema } from '../../../schema';
import type {
    ObjectLiteral,
} from '../../../types';
import type { ParseIssueOptions } from '../../types';

export type SortsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = ParseIssueOptions & {
    relations?: Relations,
    throwOnFailure?: boolean,
    strict?: boolean,
    schema?: string | Schema<RECORD> | SortsSchema<RECORD>,
    context?: unknown,
};

/**
 * @deprecated use {@link SortsParseOptions}. Removed in 3.0.
 */
export type SortParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = SortsParseOptions<RECORD>;
