/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * One binding per relation path: the array element (or NULL row)
 * a condition tree is currently evaluated against.
 */
export type BindingContext = Map<string, unknown>;

/**
 * A compiled condition node, evaluated per binding assignment.
 * null marks a vanished (empty) compound.
 */
export type ConditionEval = (ctx: BindingContext, root: unknown) => boolean;

export type FilterCompileResult = ConditionEval | null;

export type ValueTest = (value: unknown) => boolean;

export type FiltersVisitorOptions = {
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default —
     * e.g. identifier or token columns. Typically forwarded from
     * a schema's `filters.caseSensitive` list.
     *
     * `true` keeps every equality comparison case-sensitive
     * (byte-exact), for evaluating arbitrary condition trees whose
     * field keys aren't known upfront. `false` equals the default.
     */
    caseSensitive?: string[] | boolean,
};
