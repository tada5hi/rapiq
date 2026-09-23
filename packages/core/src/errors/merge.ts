/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import { isObject } from '../utils';
import { BaseError } from './base';
import { ErrorCode } from './code';
import { ErrorMessage } from './messages';
import type { BaseErrorOptions } from './types';

export class MergeError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A merging error has occurred.';
        }

        super(message || 'A merging error has occurred.');
    }

    static fieldsConditionDiscarded(name: string) {
        return new this({
            message: `Merging fields would discard the visibility condition on "${name}". ` +
                'A gated field cannot be displaced; keep the gated query as the receiver or remove the colliding field first.',
            code: ErrorCode.FIELDS_CONDITION_DISCARDED,
        });
    }

    /**
     * Two queries declaring different groups (or aggregates): a union
     * or a left win would fabricate or discard a grain, so the merge
     * refuses, following the fields visibility-gate rule (#839).
     */
    static callsConflict(parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`) {
        return new this({
            message: ErrorMessage.mergeConflict(parameter),
            code: ErrorCode.KEY_AMBIGUOUS,
        });
    }

    /**
     * The merged groups and aggregates would write the same row key, so
     * one of the two values would be lost.
     */
    static outputKeyDuplicate(key: string) {
        return new this({
            message: ErrorMessage.outputKeyDuplicate(key),
            code: ErrorCode.KEY_AMBIGUOUS,
        });
    }
}
