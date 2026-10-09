/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The part of the Rust binding `@rapiq/core` calls (JSON strings in and
 * out). Implemented by the napi addon on Node and by the WASM build
 * elsewhere; the generated declarations of the napi addon live in
 * `binding/index.d.cts`.
 */
export interface IBinding {
    planCondition(condition: string, options?: string | null) : string;
    distributeNegation(plan: string) : string;
    operatorSemantics() : string;
}

/**
 * Loads the binding on first use; supplied by the environment entry
 * (`src/index.ts` for Node, `src/browser.ts` for browsers).
 */
export type BindingLoader = () => IBinding;

/**
 * Loads the binding asynchronously (the WASM build in browsers); run by
 * `ready()`.
 */
export type BindingInitializer = () => Promise<IBinding>;

/**
 * The error half of a binding envelope: the rapiq `ErrorCode` value, the
 * message, and the argument of the matching TypeScript error factory.
 */
export type BindingErrorPayload = {
    code: string,
    message: string,
    subject?: string | null,
};

export type BindingEnvelope = { ok: true, value: unknown } |
    { ok: false, error: BindingErrorPayload };
