/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Reserved wire parameter carrying the codec identity of a payload.
 * Encoding through the registry stamps it; decoding dispatches on it
 * and falls back to the registry default when it is absent (plain
 * clients keep working without stamping anything).
 */
export const CODEC_PARAMETER = 'codec';
