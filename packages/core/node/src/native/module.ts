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
    BindingInitializer,
    BindingLoader,
    IBinding,
} from './types';

let loader : BindingLoader | undefined;
let initializer : BindingInitializer | undefined;
let pending : Promise<void> | undefined;
let binding : IBinding | undefined;

/**
 * Register how the binding is loaded. The environment entry calls this
 * once; the loader runs lazily on the first call that needs Rust, so
 * importing `@rapiq/core` never loads native code by itself.
 */
export function setBindingLoader(input: BindingLoader) : void {
    loader = input;
    initializer = undefined;
    pending = undefined;
    binding = undefined;
}

/**
 * Register an asynchronous initializer (the browser entry: fetching and
 * compiling the WASM build cannot be synchronous on a browser main thread).
 * It runs on {@link ready}; until then a call that needs Rust fails typed.
 */
export function setBindingInitializer(input: BindingInitializer) : void {
    initializer = input;
    loader = undefined;
    pending = undefined;
    binding = undefined;
}

/**
 * Resolve once the binding is usable. In browsers this loads the WASM build
 * and must be awaited before the first call that needs Rust; on Node it
 * loads the native addon right away. Isomorphic code can always call it.
 */
export async function ready() : Promise<void> {
    if (binding) {
        return;
    }

    if (initializer) {
        const init = initializer;
        pending ??= init().then(
            (output) => {
                binding = output;
            },
            (e) => {
                pending = undefined;
                throw AdapterError.bindingUnavailable(
                    e instanceof Error ? e.message : 'the binding failed to initialize.',
                    e,
                );
            },
        );

        await pending;
        return;
    }

    useBinding();
}

/**
 * Use a ready binding directly (tests, hosts embedding their own build).
 */
export function setBinding(input: IBinding) : void {
    loader = () => input;
    initializer = undefined;
    pending = undefined;
    binding = input;
}

export function useBinding() : IBinding {
    if (binding) {
        return binding;
    }

    if (!loader) {
        throw AdapterError.bindingUnavailable(initializer ?
            'await ready() before the first call that needs Rust.' :
            'no binding loader is registered for this environment.');
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
