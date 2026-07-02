/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export const KeyResolutionErrorCode = {
    KEY_INVALID: 'keyInvalid',
    KEY_NOT_PERMITTED: 'keyNotPermitted',
    PATH_NOT_PERMITTED: 'pathNotPermitted',
    SCHEMA_UNRESOLVABLE: 'schemaUnresolvable',
} as const;

export type KeyResolutionErrorCode = typeof KeyResolutionErrorCode[keyof typeof KeyResolutionErrorCode];
