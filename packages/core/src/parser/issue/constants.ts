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
 * The error class each parameter rejects client input with, where the
 * rejection is thrown rather than recorded: a `ResolutionScope` used outside a
 * parse fails on ONE violation, and naming its parameter is the whole truth
 * there. A collecting parse raises the general `INPUT_REJECTED` instead, since
 * it may have rejected input in several parameters at once.
 *
 * Typed by the class rather than by {@link IParseErrorConstructor}: the
 * resolver reaches for the static factories through the same table.
 */
export const PARAMETER_ERROR_CLASSES : Record<`${Parameter}`, typeof ParseError> = {
    [Parameter.FIELDS]: FieldsParseError,
    [Parameter.FILTERS]: FiltersParseError,
    [Parameter.PAGINATION]: PaginationParseError,
    [Parameter.RELATIONS]: RelationsParseError,
    [Parameter.SORTS]: SortsParseError,
    [Parameter.SORT]: SortsParseError,
};
