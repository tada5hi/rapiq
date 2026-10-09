/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '../errors';
import type {
    BindingEnvelope,
    BindingErrorPayload,
    BindingLoader,
    IBinding,
} from './types';

let loader : BindingLoader | undefined;
let binding : IBinding | undefined;

/**
 * Register how the binding is loaded. The environment entry calls this
 * once; the loader runs lazily on the first call that needs Rust, so
 * importing `@rapiq/core` never loads native code by itself.
 */
export function setBindingLoader(input: BindingLoader) : void {
    loader = input;
    binding = undefined;
}

/**
 * Use a ready binding directly (tests, hosts embedding their own build).
 */
export function setBinding(input: IBinding) : void {
    loader = () => input;
    binding = input;
}

export function useBinding() : IBinding {
    if (binding) {
        return binding;
    }

    if (!loader) {
        throw AdapterError.bindingUnavailable('no binding loader is registered for this environment.');
    }

    try {
        binding = loader();
    } catch (e) {
        throw AdapterError.bindingUnavailable(
            e instanceof Error ? e.message : 'the binding failed to load.',
            e,
        );
    }

    return binding;
}

/**
 * Rebuild the typed error a binding reported, through the same factory the
 * TypeScript implementation used, so code, message and the structured
 * `feature` are identical.
 */
function toError(payload: BindingErrorPayload) : AdapterError {
    const subject = payload.subject ?? undefined;

    switch (payload.code) {
        case ErrorCode.FEATURE_UNSUPPORTED: {
            if (subject !== undefined) {
                return AdapterError.featureUnsupported(subject);
            }
            break;
        }
        case ErrorCode.OPERATOR_UNSUPPORTED: {
            if (subject !== undefined) {
                return AdapterError.operatorUnsupported(subject);
            }
            break;
        }
        case ErrorCode.CONDITION_DETACHED: {
            return AdapterError.conditionDetached(subject);
        }
        default: {
            break;
        }
    }

    return new AdapterError({
        code: payload.code as `${ErrorCode}`,
        message: payload.message,
    });
}

/**
 * Call a binding function returning an envelope and unpack it: the value
 * on success, the rebuilt typed error on failure.
 */
export function callBinding<T>(fn: (binding: IBinding) => string) : T {
    const envelope = JSON.parse(fn(useBinding())) as BindingEnvelope;
    if (!envelope.ok) {
        throw toError(envelope.error);
    }

    return envelope.value as T;
}
