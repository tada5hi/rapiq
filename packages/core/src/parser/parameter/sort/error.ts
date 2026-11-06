/*
 * Copyright (c) 2023-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParseError } from '../../../errors';

export class SortsParseError extends ParseError {

}

/**
 * @deprecated use {@link SortsParseError}. Removed in 3.0.
 */
export const SortParseError = SortsParseError;

// eslint-disable-next-line @tada5hi/type-declaration-location -- Preserve the merged public value and type alias.
export type SortParseError = SortsParseError;
