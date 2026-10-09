/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';

/**
 * Fold the deprecated `sort` spelling onto the canonical `sorts`.
 * Applied wherever a caller-supplied parameter name is compared
 * against a list, so both spellings select the same parameter.
 */
export function normalizeParameter(input: string) : string {
    return input === Parameter.SORT ? Parameter.SORTS : input;
}
