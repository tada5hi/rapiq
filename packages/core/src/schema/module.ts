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
    SchemaDescribeOptions,
    SchemaDescription,
    SchemaOptions,
} from './types';
import { Parameter } from '../constants';
import { SchemaError } from '../errors';
import type { ObjectLiteral } from '../types';
import { assertKnownInputKeys } from '../utils';
import { BaseSchema } from './base';

const SCHEMA_INPUT_KEYS : string[] = [
    'name',
    'throwOnFailure',
    'strict',
    'schemaMapping',
    'indexes',
    Parameter.FIELDS,
    Parameter.FILTERS,
    Parameter.PAGINATION,
    Parameter.RELATIONS,
    Parameter.SORT,
];

export class Schema<
    RECORD extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseSchema<SchemaOptions<RECORD, CONTEXT>> {
    public readonly fields : FieldsSchema<RECORD, CONTEXT>;

    public readonly filters : FiltersSchema<RECORD, CONTEXT>;

    public readonly pagination : PaginationSchema;

    public readonly relations: RelationsSchema<RECORD, CONTEXT>;

    public readonly sort: SortSchema<RECORD, CONTEXT>;

    public readonly indexes : string[][];

    public readonly indexesIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(options: SchemaOptions<RECORD, CONTEXT> = {}) {
        super(options);

        assertKnownInputKeys(
            options,
            SCHEMA_INPUT_KEYS,
            (key, suggestion) => SchemaError.keyUnknown(key, suggestion),
        );

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

        if (typeof options.indexes === 'undefined') {
            this.indexes = [];
            this.indexesIsUndefined = true;
        } else {
            this.indexes = options.indexes.map((index) => [...index]);
            this.indexesIsUndefined = false;
        }

        this.extendSchemasOptions();
    }

    // ---------------------------------------------------------

    /**
     * Serialize the declared constraints of every (selected)
     * parameter into a JSON-safe {@link SchemaDescription}. The
     * relation target map is composed here, since the schema
     * mapping lives on this schema — an unmapped relation maps to
     * itself, mirroring registry resolution.
     */
    describe(options: SchemaDescribeOptions = {}) : SchemaDescription {
        const output : SchemaDescription = {
            name: this.options.name ?? null,
            strict: this.options.strict ?? false,
            indexes: this.indexesIsUndefined ?
                null :
                this.indexes.map((index) => [...index]),
        };

        const parameters : string[] = options.parameters || Object.values(Parameter);

        if (parameters.includes(Parameter.FIELDS)) {
            output.fields = this.fields.describe();
        }

        if (parameters.includes(Parameter.FILTERS)) {
            output.filters = this.filters.describe();
        }

        if (parameters.includes(Parameter.PAGINATION)) {
            output.pagination = this.pagination.describe();
        }

        if (parameters.includes(Parameter.RELATIONS)) {
            output.relations = this.relations.describe();

            if (output.relations.allowed) {
                const schemas : Record<string, string> = {};
                for (const relation of output.relations.allowed) {
                    schemas[relation] = this.mapSchema(relation);
                }

                output.relations.schemas = schemas;
            }
        }

        if (parameters.includes(Parameter.SORT)) {
            output.sort = this.sort.describe();
        }

        return output;
    }

    // ---------------------------------------------------------

    private extendSchemasOptions() {
        this.extendSchemaOptions(this.fields);
        this.extendSchemaOptions(this.filters);
        this.extendSchemaOptions(this.pagination);
        this.extendSchemaOptions(this.relations);
        this.extendSchemaOptions(this.sort);

        if (!this.indexesIsUndefined) {
            this.filters.setIndexes(this.indexes);
            this.sort.setIndexes(this.indexes);
        }
    }

    private extendSchemaOptions(schema: BaseSchema<any>) {
        if (
            typeof this.options.throwOnFailure !== 'undefined' &&
            typeof schema.throwOnFailure === 'undefined'
        ) {
            schema.throwOnFailure = this.options.throwOnFailure;
        }

        if (
            typeof this.options.strict !== 'undefined' &&
            typeof schema.strict === 'undefined'
        ) {
            schema.strict = this.options.strict;
        }

        if (typeof this.options.name !== 'undefined') {
            schema.name = this.options.name;
        }
    }
}
