/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../constants';
import type { ParseError } from '../../errors';
import { FieldsParseError } from '../parameter/fields/error';
import { FiltersParseError } from '../parameter/filters/error';
import { PaginationParseError } from '../parameter/pagination/error';
import { RelationsParseError } from '../parameter/relations/error';
import { SortsParseError } from '../parameter/sort/error';

/**
 * The error class each parameter rejects client input with — the default
 * reconstruction target for an issue whose site recorded no explicit class.
 */
export const PARAMETER_ERROR_CLASSES : Record<`${Parameter}`, typeof ParseError> = {
    [Parameter.FIELDS]: FieldsParseError,
    [Parameter.FILTERS]: FiltersParseError,
    [Parameter.PAGINATION]: PaginationParseError,
    [Parameter.RELATIONS]: RelationsParseError,
    [Parameter.SORTS]: SortsParseError,
    [Parameter.SORT]: SortsParseError,
};
