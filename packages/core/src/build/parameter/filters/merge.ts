/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import { isCondition } from '../../../parameter';
import type { CONDITION_MARKER } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import type { FiltersBuildInput } from './types';
import { isNestedRecordValue } from './value';

/**
 * Excludes a live condition from an input position at compile time. The
 * generic-less arm resolves `FiltersBuildInput<ObjectLiteral>` to a bag of
 * `any` values, which a condition object structurally satisfies, so without
 * this the type-level half of the guard would hold only for callers who
 * supply the record generic.
 */
type NotACondition = { [CONDITION_MARKER]?: never };

/**
 * Per-field replace over filter build input: the first input to constrain a
 * field wins it, and every field only one side constrains survives. This is
 * the override-a-default operation, and it lives here rather than on the
 * `Query` because a build input is plain data: it cannot carry a
 * server-authored scope, so replacement cannot displace one. Composition of
 * queries is conjunction and never drops a predicate ({@link mergeQueries}).
 *
 * Both notations {@link FiltersBuildInput} admits address the same fields —
 * `{ 'realm.name': v }` and `{ realm: { name: v } }` — so inputs are reduced
 * to their canonical dotted paths before being compared. Two inputs written
 * in different notations therefore still replace each other, and a nested
 * record is replaced key by key instead of wholesale the way an object
 * spread would.
 *
 * ```typescript
 * mergeFiltersInput<User>(
 *     { realm: { name: 'b' } },
 *     { 'realm.name': 'a', 'realm.id': 1 },
 * );
 * // { 'realm.name': 'b', 'realm.id': 1 }
 * ```
 *
 * Replacement is per field, not per operator: `{ age: { $gte: 18 } }` beating
 * `{ age: { $lt: 65 } }` yields the lower bound alone. Keeping both is
 * conjunction, which is what composing two queries does.
 *
 * A `$elemMatch` interior is a value, replaced whole. An `undefined` value
 * claims no field, so a later input still supplies it. The result is the flat
 * notation, itself valid input for {@link defineFilters} or another merge.
 */
export function mergeFiltersInput(
    ...input: (FiltersBuildInput<ObjectLiteral> & NotACondition)[]
) : FiltersBuildInput<ObjectLiteral>;
export function mergeFiltersInput<
    RECORD extends ObjectLiteral,
>(...input: (FiltersBuildInput<RECORD> & NotACondition)[]) : FiltersBuildInput<RECORD>;
export function mergeFiltersInput(
    ...input: FiltersBuildInput<ObjectLiteral>[]
) : FiltersBuildInput<ObjectLiteral> {
    const output : Record<string, unknown> = {};

    for (const current of input) {
        collectPaths(current, '', output);
    }

    return output as FiltersBuildInput<ObjectLiteral>;
}

/**
 * Reduce one input to canonical dotted paths, keeping the first value seen
 * for each. First-occurrence priority is applied here rather than by the
 * caller so it holds within a single input too: an input naming one field
 * under both notations resolves the same way two inputs do.
 */
function collectPaths(
    input: unknown,
    prefix: string,
    output: Record<string, unknown>,
) : void {
    // a live condition is not build input. Admitting one would make this a
    // second composition path over server-authored trees, which is the
    // primitive filter composition was made conjunctive to remove.
    if (isCondition(input)) {
        throw BuildError.inputInvalid();
    }

    if (!isObject(input)) {
        throw BuildError.inputInvalid();
    }

    for (const key of Object.keys(input)) {
        const value = input[key];

        // skipped rather than recorded, so `{ name: undefined }` states no
        // opinion instead of claiming the field and blanking it. Mirrors the
        // build layer, which lowers such a key to no condition at all.
        if (typeof value === 'undefined') {
            continue;
        }

        const field = prefix ? `${prefix}.${key}` : key;

        // a `$`-prefixed root key is not a field. It is passed through
        // unresolved so defineFilters still reports it, rather than being
        // reinterpreted as a path segment here.
        if (!prefix && key.substring(0, 1) === '$') {
            if (!Object.hasOwn(output, key)) {
                output[key] = value;
            }

            continue;
        }

        if (isNestedRecordValue(field, value)) {
            collectPaths(value, field, output);

            continue;
        }

        if (!Object.hasOwn(output, field)) {
            output[field] = value;
        }
    }
}
