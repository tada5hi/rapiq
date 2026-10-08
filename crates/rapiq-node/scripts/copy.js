/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// Copies the compiled cdylib next to the wrapper as `rapiq.node`
// (what `napi build` does, without the CLI dependency).

import { copyFileSync } from 'node:fs';
import { platform } from 'node:process';

const names = {
    darwin: 'librapiq_node.dylib',
    linux: 'librapiq_node.so',
    win32: 'rapiq_node.dll',
};

const name = names[platform];
if (!name) {
    throw new Error(`Unsupported platform: ${platform}`);
}

const source = new URL(`../../../target/release/${name}`, import.meta.url);
const target = new URL('../rapiq.node', import.meta.url);

copyFileSync(source, target);
