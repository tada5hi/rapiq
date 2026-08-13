/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';
import type { FiltersSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { ParseIssueOptions } from '../../types';

export type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = ParseIssueOptions & {
    relations?: Relations,
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>,
    /**
     * Throw on a key resolution failure instead of dropping the key.
     * Honored by the simple and mongo dialects. The expression dialect
     * IGNORES it and always throws: an expression cannot be partially
     * reinterpreted safely — pruning a leaf inside `or(...)` would
     * change the compound's meaning rather than narrow it.
     */
    throwOnFailure?: boolean,
    strict?: boolean,
    context?: unknown,
};
