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

    KEY_VALIDATE_REJECTED = 'keyValidateRejected',

    OPERATOR_UNSUPPORTED = 'operatorUnsupported',

    FEATURE_UNSUPPORTED = 'featureUnsupported',

    FILTERS_NOT_FLAT = 'filtersNotFlat',

    CODEC_UNRESOLVABLE = 'codecUnresolvable',

    SCHEMA_ENTITY_MISMATCH = 'schemaEntityMismatch',

    SCHEMA_NAME_INVALID = 'schemaNameInvalid',

    SCHEMA_UNRESOLVABLE = 'schemaUnresolvable',

    SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER = 'schemaValidatorAsyncRequiresAsyncParser',
}
