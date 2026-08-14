/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The message text of every client-input failure, as pure builders.
 *
 * A failure surfaces through two channels — a thrown {@link ParseError} and a
 * plain-data {@link Issue} — and both must read identically: an aggregated
 * error is rebuilt from its issue, so a divergence here would change a thrown
 * message depending on the failure policy. Building the text without
 * constructing an `Error` also keeps the drop-mode trace free of stack capture.
 */
export const ErrorMessage = {
    inputInvalid: () => 'The shape of the input is not valid.',

    inputRejected: (count: number) => (count === 1 ?
        'The input was rejected: 1 violation.' :
        `The input was rejected: ${count} violations.`),

    syntaxInvalid: (details?: string) => (details ?
        `The input syntax is invalid: ${details}` :
        'The input syntax is invalid.'),

    keyNotPermitted: (name: string) => `The key ${name} is not permitted.`,

    keyInvalid: (key: string) => `The key ${key} is invalid.`,

    keyPathInvalid: (key: string) => `The key path ${key} is invalid.`,

    keyPathNotPermitted: (key: string) => `The key path ${key} is not permitted.`,

    keyValueInvalid: (key: string) => `The value of the key ${key} is invalid.`,

    keyValidateRejected: (key: string) => `The key ${key} was rejected by the schema validator.`,

    keyCombinationNotIndexed: (keys: string[]) => `The key combination ${keys.join(', ')} is not indexed.`,

    operatorUnsupported: (operator: string) => `The operator ${operator} is not supported.`,

    featureUnsupported: (feature: string) => `The feature ${feature} is not supported.`,

    keyAmbiguous: (canonical: string, alias: string) => `The keys ${canonical} and ${alias} are two spellings of the ` +
        `same parameter. Use ${canonical}.`,

    limitExceeded: (limit: number) => `The pagination limit must not exceed the value of ${limit}.`,

    /**
     * Not a violation: the parameter fell back to its schema default because
     * nothing the client sent survived.
     */
} as const;
