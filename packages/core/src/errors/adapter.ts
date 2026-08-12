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

export type AdapterErrorOptions = BaseErrorOptions & {
    /**
     * The capability tag {@link AdapterError.featureUnsupported} refuses
     * (e.g. `regexp`, `filters:mod`, `filters:regex`), structured
     * alongside `code` so a consumer can build a capability matrix
     * without parsing the message. `undefined` for every other factory.
     */
    feature?: string,
};

export class AdapterError extends BaseError {
    public readonly feature : string | undefined;

    constructor(message?: string | AdapterErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'An adapter error has occurred.';
        }

        super(message || 'An adapter error has occurred.');

        this.feature = isObject(message) ? message.feature : undefined;
    }

    static operatorUnsupported(operator: string) {
        return new this({
            message: `The filter operator ${operator} is not supported.`,
            code: ErrorCode.OPERATOR_UNSUPPORTED,
        });
    }

    /**
     * A condition the built-in consumer cannot lower: either a live custom
     * implementation that needs its own consumer or detached transport data
     * that lost its behavior. Dropping it would silently widen the result set.
     */
    static conditionDetached(operator?: string) {
        return new this({
            message: `The condition${operator ? ` (${operator})` : ''} cannot be lowered by this built-in consumer. ` +
                'A custom condition needs a compatible consumer; detached transport data must be rebuilt ' +
                'with the condition helpers (eq, and, or, …) before passing it to an adapter.',
            code: ErrorCode.CONDITION_DETACHED,
        });
    }

    static featureUnsupported(feature: string) {
        return new this({
            message: `The feature ${feature} is not supported by the dialect.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature,
        });
    }
}
