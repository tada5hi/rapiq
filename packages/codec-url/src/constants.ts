/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Reserved wire parameter carrying the codec identity of a payload.
 * Encoding through the facade stamps it; decoding dispatches on it.
 * When absent, the built-in facade recognizes expression versus
 * legacy simple input from the filter wire shape.
 */
export const CODEC_PARAMETER = 'codec';
