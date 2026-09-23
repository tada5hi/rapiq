/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../../../constants';
import { BuildError, ErrorCode } from '../../../errors';
import type { CallLowering, CallTerm } from '../../../parameter';
import { resolveCallTerm } from '../../../schema';
import { isCallIdentifierValid, isObject } from '../../../utils';

type CallNodeOptions = CallTerm & {
    lowering: CallLowering | undefined,
};

function isCallBuildInput(input: unknown) : input is { name: string, params?: string[] } {
    return isObject(input) &&
        typeof input.name === 'string' &&
        (
            typeof input.params === 'undefined' ||
            (Array.isArray(input.params) && input.params.every((param) => typeof param === 'string'))
        );
}

/**
 * Turn one build element into node options. A primitive or a bare
 * group column resolves against the built-in table; any other callee
 * is a named function only a schema can resolve, so it travels
 * unresolved (`lowering` undefined) and adapters refuse it until a
 * server parse resolved it.
 */
export function buildCallOptions(
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    input: unknown,
) : CallNodeOptions {
    let term : CallTerm;
    if (typeof input === 'string') {
        term = { name: input, params: [] };
    } else if (isCallBuildInput(input)) {
        term = { name: input.name, params: [...(input.params ?? [])] };
    } else {
        throw BuildError.inputInvalid();
    }

    const resolution = resolveCallTerm(parameter, term);
    if (resolution.success) {
        return { ...term, lowering: resolution.lowering };
    }

    switch (resolution.code) {
        case ErrorCode.OPERATOR_UNSUPPORTED:
            return { ...term, lowering: undefined };
        case ErrorCode.KEY_INVALID:
        case ErrorCode.KEY_PATH_NOT_ALLOWED:
            throw BuildError.keyInvalid(
                [term.name, ...term.params].find((identifier) => !isCallIdentifierValid(identifier)) ??
                term.name,
            );
        case ErrorCode.KEY_VALUE_INVALID:
            throw BuildError.keyValueInvalid(term.name);
        default:
            throw BuildError.inputInvalid();
    }
}

/**
 * Two terms with one key would write the same row key, so one value
 * would be lost.
 */
export function assertCallKeysUnique(keys: string[]) : void {
    const seen = new Set<string>();

    for (const key of keys) {
        if (seen.has(key)) {
            throw BuildError.outputKeyDuplicate(key);
        }

        seen.add(key);
    }
}
