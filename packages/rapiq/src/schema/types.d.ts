import type { FieldsOptions, FieldsSchema, FiltersOptions, FiltersSchema, PaginationOptions, PaginationSchema, RelationsOptions, RelationsSchema, SortOptions, SortSchema } from './parameter';
import type { ObjectLiteral } from '../types';
export type BaseSchemaOptions = {
    /**
     * Name of the schema.
     */
    name?: string;
    /**
     * throw an error on invalid input for building or parsing
     * input data.
     */
    throwOnFailure?: boolean;
    /**
     * Map alias to schema name
     */
    schemaMapping?: Record<string, string>;
};
export type VerifyFn<VALUE = unknown, CONTEXT extends Record<PropertyKey, any> = Record<string, any>> = (value: VALUE, context: CONTEXT) => Promise<VALUE>;
export type SchemaOptionsNormalized<RECORD extends ObjectLiteral = ObjectLiteral> = BaseSchemaOptions & {
    fields: FieldsOptions<RECORD> | FieldsSchema<RECORD>;
    filters: FiltersOptions<RECORD> | FiltersSchema<RECORD>;
    relations: RelationsOptions<RECORD> | RelationsSchema<RECORD>;
    pagination: PaginationOptions | PaginationSchema;
    sort: SortOptions<RECORD> | SortSchema<RECORD>;
};
export type SchemaOptions<RECORD extends ObjectLiteral = ObjectLiteral> = Partial<SchemaOptionsNormalized<RECORD>>;
//# sourceMappingURL=types.d.ts.map