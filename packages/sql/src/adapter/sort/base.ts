/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortDirection } from '@rapiq/core';
import { parseField } from '../../helpers';
import type { RelationsBaseAdapter } from '../relations';
import type { ISortAdapter } from './types';

export abstract class SortBaseAdapter<
    TARGET extends Record<string, any> = Record<string, any>,
> implements ISortAdapter<TARGET> {
    protected relations: RelationsBaseAdapter<TARGET>;

    protected value : Record<string, `${SortDirection}`>;

    protected target : TARGET | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter<TARGET>,
    ) {
        this.relations = relations;
        this.value = {};
    }

    // -----------------------------------------------------------

    setTarget(target?: TARGET) {
        this.target = target;
    }

    // -----------------------------------------------------------

    clear() {
        this.value = {};
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract escapeField(field: string) : string;

    abstract execute() : void;

    // -----------------------------------------------------------

    add(input: string, value: `${SortDirection}`) {
        const name = this.normalizeField(input);

        this.value[name] = value;
    }

    /**
     * Escaped ORDER BY entries, e.g. ['"user"."age" DESC'].
     */
    getOrderBy() : string[] {
        const keys = Object.keys(this.value);
        const output : string[] = [];

        for (const key_ of keys) {
            const key = key_ as string;
            output.push(`${key} ${this.value[key]}`);
        }

        return output;
    }

    protected normalizeField(input: string) {
        const output = parseField(input, this.rootAlias());
        if (output.relation) {
            this.relations.add(output.relation);
        }

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(output.name)}`;
        }

        return this.escapeField(output.name);
    }
}
