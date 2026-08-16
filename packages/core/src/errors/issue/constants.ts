/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Upper bound of leaf issues one parse records. Hostile input can violate a
 * policy once per key, and the trace is a diagnostic, not a transcript: what
 * the parse raises (`INPUT_REJECTED`, as the parse that failed) does not
 * depend on how many rejections it holds, so a truncated tail changes nothing
 * about the outcome.
 */
export const MAX_ISSUES = 100;
