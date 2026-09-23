/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export type CallSlotName = 'field' | 'unit';

export type CallSlot = {
    name: CallSlotName,
    optional: boolean,
};

/**
 * A term exactly as the client wrote it: `scope` is { name: 'scope', params: [] },
 * `period(day)` is { name: 'period', params: ['day'] }, `count()` equals `count`.
 */
export type CallTerm = {
    name: string,
    params: string[],
};

/**
 * What an adapter lowers. Resolved server side (schema) or from the
 * built-in primitive table (schemaless parse, build layer); never on the wire.
 */
export type CallLowering = {
    /**
     * Primitive (`bucket`, `count`, `sum`); undefined only for a bare-column
     * group. An open string: an adapter refuses a primitive it does not know.
     */
    readonly fn: string | undefined,
    /** Root column; undefined only for count(). */
    readonly field: string | undefined,
    /** Primitive arguments after the field: bucket gives [unit], otherwise []. */
    readonly args: readonly string[],
};
