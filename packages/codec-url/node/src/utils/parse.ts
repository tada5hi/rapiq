/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { parse } from 'qs';

/**
 * qs treats a leading `?` as part of the first key name, so a caller
 * passing `url.search` verbatim would silently lose every parameter
 * (`?filter` is not a known wire key). Strip a single leading `?`
 * before parsing — the same tolerance URLSearchParams applies.
 */
export function parseQueryString(input: string) : unknown {
    return parse(input.charAt(0) === '?' ? input.substring(1) : input);
}
