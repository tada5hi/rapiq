/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilter } from '../../../parameter';
import type {
    MaybeAsync,
    ObjectLiteral, 
    SimpleKeys,
} from '../../../types';
import type { BaseSchemaOptions } from '../../types';

/**
 * Per-leaf filter validation hook. The return value decides the leaf's fate:
 * return the input filter to accept it, another `Filter` to replace it, or
 * `undefined` to reject it. An inspect-only hook must therefore end with
 * `return input` — a bare block body would reject every filter. The result
 * may also be a Promise of any of those values; resolving it requires the
 * `parseAsync()` / `decodeAsync()` / `encodeAsync()` entry points.
 *
 * The second argument is the value passed to `parse()` / `decode()` via
 * the `context` option (`undefined` when the caller supplied none), so a
 * shared schema can make per-request decisions (e.g. actor permissions).
 */
export type Validator<CONTEXT = any> = (
    input: IFilter,
    context: CONTEXT,
) => MaybeAsync<IFilter | undefined>;

export type FiltersOptions<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: ICondition,
    validate?: Validator<CONTEXT>,
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default —
     * e.g. identifier or token columns. Keys are resolved names
     * (after mapping), matching the entries of `allowed`.
     */
    caseSensitive?: SimpleKeys<T>[],
};
