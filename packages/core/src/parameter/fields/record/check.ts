/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IField, IFieldVisitor } from './types';

/**
 * A `Field` record is identified by its visitor dispatch: accept() of a
 * field node calls visitField and nothing else. Works across package
 * instances, where instanceof fails, and distinguishes the structurally
 * overlapping record nodes (Field, Sort, Relation).
 */
export function isField(input: unknown) : input is IField {
    return dispatchesTo<IFieldVisitor<unknown>>(input, 'visitField');
}
