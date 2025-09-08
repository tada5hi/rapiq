/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DialectOptions } from '../dialect';
import { FieldsContainer } from './fields';
import { FiltersContainer } from './filters';
import { PaginationContainer } from './pagination';
import type { JoinRelationFn } from './relations/module';
import { RelationsContainer } from './relations/module';

export type ContainerOptions<
    QUERY extends Record<string, any> = Record<string, any>,
> = DialectOptions & {
    applyRelation: JoinRelationFn<QUERY>
};

export class Container<
    QUERY extends Record<string, any> = Record<string, any>,
> {
    public readonly relations : RelationsContainer<QUERY>;

    public readonly fields : FieldsContainer<QUERY>;

    public readonly filters : FiltersContainer<QUERY>;

    public readonly pagination : PaginationContainer<QUERY>;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    constructor(options: ContainerOptions<QUERY>) {
        this.relations = new RelationsContainer<QUERY>({
            join: options.applyRelation,
        });
        this.fields = new FieldsContainer(this.relations, {
            escapeField: options.escapeField,
        });

        this.filters = new FiltersContainer(this.relations, {
            paramPlaceholder: options.paramPlaceholder,
            regexp: options.regexp,
            escapeField: options.escapeField,
        });

        this.pagination = new PaginationContainer<QUERY>();
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;

        this.relations.withQuery(query);
        this.fields.withQuery(query);
        this.filters.withQuery(query);
        this.pagination.withQuery(query);
    }

    // -----------------------------------------------------------

    // todo: apply all container results to query
    apply(_rootAlias?: string) {
        // todo: exclude already applied containers
    }
}
