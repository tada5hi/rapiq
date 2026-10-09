/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// The one Node built-in the Node entry (src/index.ts) uses. Declared here
// instead of adding @types/node to the build, which would let shared code
// use Node APIs unnoticed; it merges with @types/node where that is loaded.
declare module 'node:module' {
    export function createRequire(path: string | URL): (id: string) => unknown;
}
