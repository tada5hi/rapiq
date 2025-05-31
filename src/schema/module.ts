/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    FieldsSchema,
    FiltersSchema,
    PaginationSchema,
    RelationsSchema,
    SortSchema,

    defineFieldsSchema,
    defineFiltersSchema,
    definePaginationSchema,
    defineRelationsSchema,
    defineSortSchema,
} from './parameter';
import type {
    SchemaOptions,
} from './types';
import type { ObjectLiteral } from '../types';
import { BaseSchema } from './base';

export class Schema<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<SchemaOptions<RECORD>> {
    public readonly fields : FieldsSchema<RECORD>;

    public readonly filters : FiltersSchema<RECORD>;

    public readonly pagination : PaginationSchema;

    public readonly relations: RelationsSchema<RECORD>;

    public readonly sort: SortSchema<RECORD>;

    // ---------------------------------------------------------

    constructor(options: SchemaOptions<RECORD> = {}) {
        super(options);

        if (options.fields instanceof FieldsSchema) {
            this.fields = options.fields;
        } else {
            this.fields = defineFieldsSchema(options.fields);
        }

        if (options.filters instanceof FiltersSchema) {
            this.filters = options.filters;
        } else {
            this.filters = defineFiltersSchema(options.filters);
        }

        if (options.pagination instanceof PaginationSchema) {
            this.pagination = options.pagination;
        } else {
            this.pagination = definePaginationSchema(options.pagination);
        }

        if (options.relations instanceof RelationsSchema) {
            this.relations = options.relations;
        } else {
            this.relations = defineRelationsSchema(options.relations);
        }

        if (options.sort instanceof SortSchema) {
            this.sort = options.sort;
        } else {
            this.sort = defineSortSchema(options.sort);
        }

        this.extendSchemasOptions();
    }

    // ---------------------------------------------------------

    private extendSchemasOptions() {
        this.extendSchemaOptions(this.fields);
        this.extendSchemaOptions(this.filters);
        this.extendSchemaOptions(this.pagination);
        this.extendSchemaOptions(this.relations);
        this.extendSchemaOptions(this.sort);
    }

    private extendSchemaOptions(schema: BaseSchema<any>) {
        if (
            typeof this.options.throwOnFailure !== 'undefined' &&
            typeof schema.throwOnFailure === 'undefined'
        ) {
            schema.throwOnFailure = this.options.throwOnFailure;
        }

        if (typeof this.options.name !== 'undefined') {
            schema.name = this.options.name;
        }
    }
}
