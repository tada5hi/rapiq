/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum ErrorCode {
    NONE = 'none',

    /**
     * One or more parts of the input were rejected. The code of an aggregated
     * parse failure: what was rejected, and why, is in `error.issues`: a
     * request can violate several policies at once, and naming one of them on
     * the error would describe a subset of what went wrong.
     */
    INPUT_REJECTED = 'inputRejected',

    INPUT_INVALID = 'inputInvalid',

    SYNTAX_INVALID = 'syntaxInvalid',

    KEY_INVALID = 'keyInvalid',

    KEY_PATH_INVALID = 'keyPathInvalid',

    KEY_NOT_ALLOWED = 'keyNotAllowed',

    KEY_PATH_NOT_ALLOWED = 'keyPathNotAllowed',

    KEY_VALUE_INVALID = 'keyValueInvalid',

    KEY_VALIDATE_REJECTED = 'keyValidateRejected',

    KEY_UNKNOWN = 'keyUnknown',

    KEY_AMBIGUOUS = 'keyAmbiguous',

    KEY_COMBINATION_NOT_INDEXED = 'keyCombinationNotIndexed',

    LIMIT_EXCEEDED = 'limitExceeded',

    OPERATOR_UNSUPPORTED = 'operatorUnsupported',

    FEATURE_UNSUPPORTED = 'featureUnsupported',

    FIELDS_CONDITION_DISCARDED = 'fieldsConditionDiscarded',

    CONDITION_DETACHED = 'conditionDetached',

    CODEC_UNRESOLVABLE = 'codecUnresolvable',

    SCHEMA_ENTITY_INDEX_MISMATCH = 'schemaEntityIndexMismatch',

    SCHEMA_ENTITY_MISMATCH = 'schemaEntityMismatch',

    SCHEMA_KEY_VALIDATOR_CONFLICT = 'schemaKeyValidatorConflict',

    SCHEMA_NAME_INVALID = 'schemaNameInvalid',

    SCHEMA_PRESERVED_CONDITION_PRUNED = 'schemaPreservedConditionPruned',

    SCHEMA_UNRESOLVABLE = 'schemaUnresolvable',

    SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER = 'schemaValidatorAsyncRequiresAsyncParser',
}
