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
import type { IndexedMode } from '../../indexes';
import type { BaseSchemaOptions } from '../../types';

/**
 * Per-leaf filter validation hook. The return value decides the leaf's fate:
 * return the input filter to accept it, another condition to replace it, or
 * `undefined` to reject it. The replacement may be any `ICondition`,
 * including a compound (`and(...)`/`or(...)`), so a single authorization
 * decision like "you may filter on realm_id, but only within your realms"
 * can stay attached to the leaf that triggered it. An inspect-only hook
 * must therefore end with `return input` — a bare block body would reject
 * every filter. The result may also be a Promise of any of those values;
 * resolving it requires the `parseAsync()` / `decodeAsync()` /
 * `encodeAsync()` entry points.
 *
 * The second argument is the value passed to `parse()` / `decode()` via
 * the `context` option (`undefined` when the caller supplied none), so a
 * shared schema can make per-request decisions (e.g. actor permissions).
 */
export type Validator<CONTEXT = any> = (
    input: IFilter,
    context: CONTEXT,
) => MaybeAsync<ICondition | undefined>;

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
    /**
     * Check parsed filter trees against the schema-level `indexes`
     * declaration: `true`/`'anchor'` requires one index-leading
     * conjunct per AND group, `'cover'` full prefix coverage.
     */
    indexed?: boolean | IndexedMode,
};

/**
 * JSON-serializable snapshot of the filter constraints a schema
 * declares. Only the consumer-facing vocabulary is exposed — the
 * `default` condition is a server-injected baseline, not something
 * a client can send, so it is deliberately absent. The shape is
 * uniform across schemas: a `null` allow-list was never declared
 * (fallback semantics apply); an empty array is an explicit
 * "nothing".
 */
export type FiltersSchemaDescription = {
    allowed: string[] | null,
    indexed: IndexedMode | false,
};
