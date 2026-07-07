/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum ErrorCode {
    NONE = 'none',

    INPUT_INVALID = 'inputInvalid',

    SYNTAX_INVALID = 'syntaxInvalid',

    KEY_INVALID = 'keyInvalid',

    KEY_PATH_INVALID = 'keyPathInvalid',

    KEY_NOT_ALLOWED = 'keyNotAllowed',

    KEY_PATH_NOT_ALLOWED = 'keyPathNotAllowed',

    KEY_VALUE_INVALID = 'keyValueInvalid',

    OPERATOR_UNSUPPORTED = 'operatorUnsupported',

    FEATURE_UNSUPPORTED = 'featureUnsupported',

    FILTERS_NOT_FLAT = 'filtersNotFlat',
}
