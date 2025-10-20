/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { FilterTokenType } from './constants';
import type { FiltersParseOptions } from '../types';
import type { Relations } from '../../../../parameter';

export type FilterToken = {
    type: `${FilterTokenType}`,
    value?: string
};

export type FilterExpressionParseOptions = {
    schema?: FiltersParseOptions['schema'],
    negation?: boolean,
    relations?: Relations
};
