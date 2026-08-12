/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../types';

/**
 * Spellings that are not input keys but are close enough to be typed
 * by accident: the URL wire names (`filter`, `page`, `include`) and
 * obvious singulars. A mistyped key would otherwise be dropped, and a
 * dropped filter means unfiltered data rather than no data.
 */
const INPUT_KEY_SUGGESTIONS : Record<string, string> = {
    field: 'fields',
    filter: 'filters',
    include: 'relations',
    limit: 'pagination',
    offset: 'pagination',
    page: 'pagination',
    relation: 'relations',
};

export function suggestInputKey(key: string) : string | undefined {
    return INPUT_KEY_SUGGESTIONS[key];
}

/**
 * Reject any top-level key the surface does not understand. Only for
 * developer-authored input (build input, schema options), never for
 * client input: a decoded URL legitimately carries unrelated keys.
 */
export function assertKnownInputKeys(
    input: ObjectLiteral,
    known: string[],
    createError: (key: string, suggestion?: string) => Error,
) : void {
    const keys = Object.keys(input);

    for (const key of keys) {
        if (!known.includes(key)) {
            throw createError(key, suggestInputKey(key));
        }
    }
}
