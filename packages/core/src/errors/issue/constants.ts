/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Upper bound of issues one parse records. Hostile input can violate a policy
 * once per key, and the trace is a diagnostic, not a transcript — the first
 * error decides what the parse throws, so a truncated tail changes nothing
 * about the outcome. The issue a parse fails on is kept regardless.
 */
export const MAX_ISSUES = 100;
