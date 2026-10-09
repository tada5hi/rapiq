/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { dispatchesTo } from '../../../utils';
import type { IRelation, IRelationVisitor } from './types';

/**
 * A `Relation` record is identified by its visitor dispatch: accept()
 * of a relation node calls visitRelation and nothing else. Works across
 * package instances, where instanceof fails, and distinguishes the
 * structurally overlapping record nodes (Relation, Field, Sort).
 */
export function isRelation(input: unknown) : input is IRelation {
    return dispatchesTo<IRelationVisitor<unknown>>(input, 'visitRelation');
}
