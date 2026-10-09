/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Browser entry (`browser` export condition): the public API without any
 * Node built-in. The WASM build of the binding registers here once the
 * WASM fallback lands (decision D2 in internal-docs/rust/MIGRATION.md);
 * until then a call that needs Rust fails typed (`bindingUnavailable`),
 * and a host can supply a binding itself through `setBinding()`.
 */

export * from './module';
