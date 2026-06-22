/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
                return new Fields(this.toUnique(explicates).map((item) => new Field(item)));
            }

            return new Fields(this.toUnique(includes).map((item) => new Field(item)));
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
            ).map((el) => new Field(el)),
        );
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
