/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IR_HOST_REF_KEY } from './constants';

/**
 * Descriptor of a host value reference: the facts the Rust lowering reads
 * (string conversion, truthiness, regex source/flags, finite number,
 * a detached condition's operator), plus the index of the original value
 * in the {@link IRValueTable}.
 */
export type IRValueRef = {
    [IR_HOST_REF_KEY]: number,
    type: string,
    text: string,
    truthy: boolean,
    number?: number,
    source?: string,
    flags?: string,
    operator?: string,
};

/**
 * The serialized filter IR: the language-neutral form of a built-in
 * condition tree, with an explicit `type` discriminant. `custom` stands for
 * a condition kind the IR cannot express (opaque to the Rust core).
 */
export type FilterIR = {
    type: 'filter',
    operator: string,
    field: string,
    value: unknown,
};

export type FiltersIR = {
    type: 'filters',
    operator: string,
    value: ConditionIR[],
};

export type CustomConditionIR = {
    type: 'custom',
    operator?: string,
};

export type ConditionIR = FilterIR | FiltersIR | CustomConditionIR;
