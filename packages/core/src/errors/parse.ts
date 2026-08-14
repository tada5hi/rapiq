/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { BaseError } from './base';
import { PARSE_ERROR_MARKER, markError } from './check';
import { ErrorCode } from './code';
import { ErrorMessage } from './messages';
import type { Issue } from 'blemish';
import type { BaseErrorOptions, IParseError } from './types';

export class ParseError extends BaseError implements IParseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A parsing error has occurred.';
        }

        super(message || 'A parsing error has occurred.');

        markError(this, PARSE_ERROR_MARKER);
    }

    /**
     * The failure an aggregated parse raises: every violation it found, on
     * `issues`. Deliberately NOT the first violation's own class and code —
     * a parse that rejected keys in four parameters would then advertise one
     * of them, and a consumer branching on that would act on a subset of what
     * went wrong. The specific classes stay what a single violation throws
     * where no trace is collecting.
     *
     * A structural abort caught on the way is not carried either: only branded
     * parse errors are ever caught (a server bug propagates untouched), and
     * everything a client-input failure knows is already in its issue.
     */
    static inputRejected(issues: readonly Issue[]) {
        return new this({
            message: ErrorMessage.inputRejected(issues.length),
            code: ErrorCode.INPUT_REJECTED,
            issues,
        });
    }

    static inputInvalid() {
        return new this({
            message: ErrorMessage.inputInvalid(),
            code: ErrorCode.INPUT_INVALID,
        });
    }

    static syntaxInvalid(details?: string) {
        return new this({
            message: ErrorMessage.syntaxInvalid(details),
            code: ErrorCode.SYNTAX_INVALID,
        });
    }

    static keyNotPermitted(name: string) {
        return new this({
            message: ErrorMessage.keyNotPermitted(name),
            code: ErrorCode.KEY_NOT_ALLOWED,
        });
    }

    static keyInvalid(key: string) {
        return new this({
            message: ErrorMessage.keyInvalid(key),
            code: ErrorCode.KEY_INVALID,
        });
    }

    static keyPathInvalid(key: string) {
        return new this({
            message: ErrorMessage.keyPathInvalid(key),
            code: ErrorCode.KEY_PATH_INVALID,
        });
    }

    static keyPathNotPermitted(key: string) {
        return new this({
            message: ErrorMessage.keyPathNotPermitted(key),
            code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        });
    }

    static keyValueInvalid(key: string) {
        return new this({
            message: ErrorMessage.keyValueInvalid(key),
            code: ErrorCode.KEY_VALUE_INVALID,
        });
    }

    static keyValidateRejected(key: string) {
        return new this({
            message: ErrorMessage.keyValidateRejected(key),
            code: ErrorCode.KEY_VALIDATE_REJECTED,
        });
    }

    static keyCombinationNotIndexed(keys: string[]) {
        return new this({
            message: ErrorMessage.keyCombinationNotIndexed(keys),
            code: ErrorCode.KEY_COMBINATION_NOT_INDEXED,
        });
    }

    static operatorUnsupported(operator: string) {
        return new this({
            message: ErrorMessage.operatorUnsupported(operator),
            code: ErrorCode.OPERATOR_UNSUPPORTED,
        });
    }

    static featureUnsupported(feature: string) {
        return new this({
            message: ErrorMessage.featureUnsupported(feature),
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }

    static keyAmbiguous(canonical: string, alias: string) {
        return new this({
            message: ErrorMessage.keyAmbiguous(canonical, alias),
            code: ErrorCode.KEY_AMBIGUOUS,
        });
    }
}
