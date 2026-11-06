/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';
import type { FiltersSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';

import type { IIssueCollector } from '../../issue';

export type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
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

export type FiltersValidationOptions = {
    /**
     * Trace of the enclosing parse.
     */
    issueCollector?: IIssueCollector,
    /**
     * Call-time failure-policy override, taking precedence over the filters
     * sub-schema's own setting exactly like everywhere else
     * (`throwOnFailure ?? schema.throwOnFailure ?? false`). Without it a leaf
     * rejection would be the one violation a call-time override cannot
     * govern.
     *
     * Deliberately NOT the resolving scope's effective policy: the expression
     * dialect forces its scope to throw because an expression cannot be
     * partially reinterpreted, and that says nothing about whether a policy
     * hook declining a leaf should fail the request.
     */
    throwOnFailure?: boolean,
    /**
     * Absolute path prefix carried through nested filter values.
     */
    path?: string[],
};
