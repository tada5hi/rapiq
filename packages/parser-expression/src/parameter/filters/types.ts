/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseOptions, ObjectLiteral } from '@rapiq/core';
import type { FilterTokenType } from './constants';

export type FilterToken = {
    type: `${FilterTokenType}`,
    value?: string
};

export type FilterExpressionParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = FiltersParseOptions<RECORD>;
