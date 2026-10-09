/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Key marking a host value reference in the IR: a value JSON cannot carry
 * faithfully (`Date`, `RegExp`, `bigint`, `NaN`, `-0`, objects) crosses
 * the language boundary as `{ "$rapiq.ref": <index>, type, text, truthy, ... }`
 * and is swapped back from the {@link IRValueTable} afterwards. Mirrors
 * `HOST_REF_KEY` of the Rust core.
 */
export const IR_HOST_REF_KEY = '$rapiq.ref';
