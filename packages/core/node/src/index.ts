/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Node entry: the public API plus the native (napi) binding, loaded lazily
 * on the first call that needs Rust. `binding/index.cjs` is the loader
 * napi-rs generates: it picks the local addon of a workspace build, or the
 * installed platform package `@rapiq/core-<platform>`.
 */

import { createRequire } from 'node:module';
import { setBindingLoader } from './native';
import type { IBinding } from './native';

setBindingLoader(() => createRequire(import.meta.url)('../binding/index.cjs') as IBinding);

export * from './module';
