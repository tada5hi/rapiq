/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Browser entry (`browser` export condition): the public API without any
 * Node built-in. The binding is the WASM build (`@rapiq/core-wasm32-wasip1`,
 * decision D2), fetched and compiled asynchronously: `await ready()` before
 * the first call that needs Rust (`planCondition`, `distributeNegation`).
 * A host can supply a binding itself through `setBinding()`.
 */

import { setBindingInitializer } from './native';
import type { IBinding } from './native';

setBindingInitializer(async () => {
    const binding : IBinding = await import('@rapiq/core-wasm32-wasip1');

    return binding;
});

export * from './module';
