/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Scalar } from '@rapiq/core';

/**
 * Coerce a wire string to its typed scalar form:
 * 'true'/'false' → boolean, 'null' → null, numeric → number,
 * anything else → trimmed string. The comma-split array
 * convention is NOT applied here — this is the pure scalar
 * normalization shared by the simple & expression dialects.
 * It is the wire's value VOCABULARY, not part of the marker
 * grammar.
 *
 * @param input
 */
export function parseFilterScalar(input: string) : Scalar {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }

    const lower = trimmed.toLowerCase();

    if (lower === 'true') {
        return true;
    }

    if (lower === 'false') {
        return false;
    }

    if (lower === 'null') {
        return null;
    }

    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
        return num;
    }

    return trimmed;
}
