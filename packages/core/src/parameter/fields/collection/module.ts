/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { MergeError } from '../../../errors';
import type { IField } from '../record';
import { Field } from '../record';
import { FieldOperator } from '../../../schema';
import type { IFields, IFieldsVisitor } from './types';

type FieldsExecuteOptions = {
    default: string[],
    allowed: string[],
};

export class Fields implements IFields {
    readonly value : IField[];

    constructor(value : IField[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IFieldsVisitor<R>): R {
        return visitor.visitFields(this);
    }

    /**
     * Keyed by name, left/receiver priority; order = first occurrence.
     * Immutable — returns a new collection.
     *
     * A name collision that would discard a visibility condition (see
     * `IField.condition`) throws a typed MergeError instead: a gate is a
     * server-authored authorization decision, and dropping it silently
     * would widen disclosure. The surviving node keeping the identical
     * condition instance is fine; anything else refuses. Filters express
     * the same protection differently: a sealed condition is carried
     * through `Filters.merge()` instead of refusing it, because a filter
     * can be and-ed in while a field is either gated or not.
     */
    merge(other: IFields) : IFields {
        const output : IField[] = [];

        const seen = new Map<string, IField>();
        for (const item of [...this.value, ...other.value]) {
            const survivor = seen.get(item.name);
            if (survivor) {
                if (
                    typeof item.condition !== 'undefined' &&
                    item.condition !== survivor.condition
                ) {
                    throw MergeError.fieldsConditionDiscarded(item.name);
                }

                continue;
            }

            seen.set(item.name, item);
            output.push(item);
        }

        return new Fields(output);
    }

    /**
     * Extract field set, with includes and excludes.
     *
     * @param options
     */
    execute(options: FieldsExecuteOptions) : IFields {
        const includes : string[] = [];
        const excludes : string[] = [];
        const explicates : string[] = [];

        for (const item of this.value) {
            if (item.operator === FieldOperator.EXCLUDE) {
                excludes.push(item.name);
            } else if (item.operator === FieldOperator.INCLUDE) {
                includes.push(item.name);
            } else {
                explicates.push(item.name);
            }
        }

        if (
            options.default.length === 0 &&
            options.allowed.length === 0
        ) {
            if (explicates.length > 0) {
                return new Fields(this.toUnique(explicates).map((item) => this.rebuild(item)));
            }

            return new Fields(this.toUnique(includes).map((item) => this.rebuild(item)));
        }

        const output : string[] = [];

        this.applyExplicates(output, explicates, options);

        if (output.length === 0) {
            output.push(...options.default);
        }

        this.applyIncludes(output, includes, options);

        if (output.length === 0) {
            output.push(...options.allowed);
        }

        return new Fields(
            this.applyExcludes(
                this.toUnique(output),
                excludes,
            ).map((el) => this.rebuild(el)),
        );
    }

    /**
     * Rebuild the resolved field `name`. The include/exclude operator is
     * deliberately consumed (execute() resolves it), but a visibility
     * condition is orthogonal metadata and must survive, so a gated field
     * cannot lose its gate by being run through the projection resolver.
     */
    protected rebuild(name: string) : IField {
        const source = this.value.find((item) => item.name === name);

        return new Field(name, undefined, source?.condition);
    }

    protected toUnique(input: string[]) : string[] {
        return Array.from(new Set([...input]));
    }

    protected applyExplicates(
        input: string[],
        explicates: string[],
        options: FieldsExecuteOptions,
    ) {
        for (const explicate of explicates) {
            let index = options.default.findIndex((item) => item === explicate);
            if (index !== -1) {
                input.push(explicate);
                continue;
            }

            index = options.allowed.findIndex((item) => item === explicate);
            if (index !== -1) {
                input.push(explicate);
            }
        }
    }

    protected applyIncludes(
        input: string[],
        includes: string[],
        options: FieldsExecuteOptions,
    ) {
        for (const include of includes) {
            let index = options.default.findIndex((item) => item === include);
            if (index !== -1) {
                input.push(include);
                continue;
            }

            index = options.allowed.findIndex((item) => item === include);
            if (index !== -1) {
                input.push(include);
            }
        }
    }

    protected applyExcludes(
        input: string[],
        excludes: string[],
    ) : string[] {
        for (const exclude of excludes) {
            const index = input.findIndex((item) => item === exclude);
            if (index === -1) {
                continue;
            }

            input.splice(index, 1);
        }

        return input;
    }
}
