/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Compile-time pins for the derived wire types — checked by
 * build:types (tsc --noEmit), so a table or core-semantics change
 * that shifts the derived types fails the build, not silently
 * downstream. Deliberately NOT re-exported from the barrel: this
 * file is a static assertion, not API.
 */

import type {
    FilterWireSpelling,
    FilterWireValueInput,
    NegatableWireOperator,
} from './types';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
    true :
    false;

type ExpectTrue<T extends true> = T;

/** The pre-derivation hand-written union (prefix forms only). */
type LegacySpelling<V extends string | number> =    V | `!${V}` | `!~${V}` | `~${V}` | `<${V}` | `<=${V}` | `>${V}` | `>=${V}`;

/** Runtime-accepted spellings the hand-written union had dropped. */
type AddedSpelling<V extends string | number> =    `${V}~` | `!${V}~` | `~${V}~` | `!~${V}~`;

export type FilterWireTypeChecks = [
    ExpectTrue<Equals<FilterWireSpelling<'x'>, LegacySpelling<'x'> | AddedSpelling<'x'>>>,
    ExpectTrue<Equals<NegatableWireOperator, 'eq' | 'contains' | 'startsWith' | 'endsWith'>>,
    ExpectTrue<Equals<Extract<FilterWireValueInput<5>, number>, 5>>,
    ExpectTrue<Equals<FilterWireValueInput<boolean>, boolean | null | '!null'>>,
];
