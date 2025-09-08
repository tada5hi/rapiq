/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { splitLast } from '../../helpers';
import type { RelationsContainer } from '../relations/module';

export abstract class AbstractFieldsContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> {
    protected relations: RelationsContainer<QUERY>;

    /**
     * selection fields.
     *
     * e.g. ['name', 'project.id']
     */
    protected items : { path: string, name: string }[];

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsContainer<QUERY>,
    ) {
        this.relations = relations;
        this.items = [];
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    // todo: make abstract

    abstract rootAlias() : string | undefined;

    abstract escapeField(field: string) : string;

    apply() {

    }

    // -----------------------------------------------------------

    add(input: string, rootAlias?: string) {
        const name = this.buildField(input, rootAlias);

        console.log(name);
        // todo: add
    }

    buildField(input: string, rootAlias?: string) {
        rootAlias ??= this.rootAlias();

        const [relation, name] = splitLast(input);
        if (!name) {
            if (rootAlias) {
                return `${this.escapeField(rootAlias)}.${this.escapeField(relation)}`;
            }

            return this.escapeField(relation);
        }

        if (!this.relations.has(relation)) {
            const joined = this.relations.add(relation, rootAlias);
            if (!joined) {
                throw new Error(`Relation ${relation} can not be joined for filter ${name}`);
            }
        }

        const [first, last] = splitLast(relation);
        if (last) {
            return `${this.escapeField(last)}.${this.escapeField(name)}`;
        }

        return `${this.escapeField(first)}.${this.escapeField(name)}`;
    }

    has(name: string) {
        return this.items.some((join) => join.path === name);
    }
}
