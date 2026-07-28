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

export abstract class SortBaseAdapter implements ISortAdapter {
    protected relations: RelationsBaseAdapter;

    protected value : Record<string, `${SortDirection}`>;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter,
    ) {
        this.relations = relations;
        this.value = {};
    }

    // -----------------------------------------------------------

    clear() {
        this.value = {};
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract escapeField(field: string) : string;

    /**
     * Resolve a parsed field name to the identifier the database knows.
     * Backends with column metadata override this to map property names
     * to column names (e.g. `realmId` -> `realm_id`); the default is the
     * identity, matching schemaless SQL usage.
     *
     * @param name last path segment (property name)
     * @param relationPath dotted relation prefix, if any
     */
    resolveFieldName(name: string, _relationPath?: string) : string {
        return name;
    }

    /**
     * Apply the accumulated state to a backend target.
     * Fragment-emitting backends have nothing to apply.
     */
    execute() : void {}

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
        const output = parseField(
            input,
            this.rootAlias(),
            (path) => this.relations.buildAlias(path),
            (path) => this.relations.isRelationPath(path),
        );
        if (output.relation) {
            this.relations.add(output.relation);
        }

        const name = this.resolveFieldName(output.name, output.relation);

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(name)}`;
        }

        return this.escapeField(name);
    }
}
