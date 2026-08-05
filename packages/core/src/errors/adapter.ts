/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';

export class AdapterError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'An adapter error has occurred.';
        }

        super(message || 'An adapter error has occurred.');
    }

    static operatorUnsupported(operator: string) {
        return new this({
            message: `The filter operator ${operator} is not supported.`,
            code: ErrorCode.OPERATOR_UNSUPPORTED,
        });
    }

    /**
     * A condition that satisfies {@link ICondition} but carries no node
     * identity — the shape left by a JSON/RPC/cache round trip. It cannot
     * be lowered, and dropping it would silently widen the result set.
     */
    static conditionDetached(operator?: string) {
        return new this({
            message: `The condition${operator ? ` (${operator})` : ''} is not a filter node. ` +
                'Rebuild it with the condition helpers (eq, and, or, …) ' +
                'before passing it to an adapter.',
            code: ErrorCode.CONDITION_DETACHED,
        });
    }

    static featureUnsupported(feature: string) {
        return new this({
            message: `The feature ${feature} is not supported by the dialect.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }
}
