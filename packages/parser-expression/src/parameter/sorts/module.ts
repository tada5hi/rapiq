/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SimpleSortsParser } from '@rapiq/parser-simple';

export class ExpressionSortsParser extends SimpleSortsParser {

}

/**
 * @deprecated use {@link ExpressionSortsParser}. Removed in 3.0.
 */
export const ExpressionSortParser = ExpressionSortsParser;

/**
 * @deprecated use {@link ExpressionSortsParser}. Removed in 3.0.
 */
export type ExpressionSortParser = ExpressionSortsParser;
