/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Stable identifier of this codec (wire dialect), e.g. for the
 * in-band `codec` parameter dispatched by the URL codec facade or an
 * out-of-band content-negotiation header.
 *
 * @deprecated For encoding, the simple dialect is retained for the v2
 * migration only. The identifier remains valid when recognizing legacy
 * input. Prefer expression encoding, which is the default.
 */
export const URL_SIMPLE_CODEC = 'url-simple';
