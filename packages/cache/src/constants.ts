/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Default cap of the tags a `TaggedCache` keeps pending.
 */
export const PENDING_INVALIDATIONS_MAX = 1000;

/**
 * The first replay delay in milliseconds, doubled after every failed
 * replay up to `REPLAY_DELAY_MAX`.
 */
export const REPLAY_DELAY_MIN = 100;

export const REPLAY_DELAY_MAX = 5000;
