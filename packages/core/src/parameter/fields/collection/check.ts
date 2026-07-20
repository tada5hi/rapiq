/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IFields, IFieldsVisitor } from './types';

/**
 * A `Fields` collection is identified by its visitor dispatch: accept()
 * of a fields node calls visitFields and nothing else. Works across
 * package instances, where instanceof fails, and distinguishes the
 * structurally identical collection nodes (Fields, Sorts, ...).
 */
export function isFields(input: unknown) : input is IFields {
    return dispatchesTo<IFieldsVisitor<unknown>>(input, 'visitFields');
}
