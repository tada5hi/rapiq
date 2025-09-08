import { FieldsSchema, FiltersSchema, PaginationSchema, RelationsSchema, SortSchema } from './parameter';
import type { SchemaOptions } from './types';
import type { ObjectLiteral } from '../types';
import { BaseSchema } from './base';
export declare class Schema<RECORD extends ObjectLiteral = ObjectLiteral> extends BaseSchema<SchemaOptions<RECORD>> {
    readonly fields: FieldsSchema<RECORD>;
    readonly filters: FiltersSchema<RECORD>;
    readonly pagination: PaginationSchema;
    readonly relations: RelationsSchema<RECORD>;
    readonly sort: SortSchema<RECORD>;
    constructor(options?: SchemaOptions<RECORD>);
    private extendSchemasOptions;
    private extendSchemaOptions;
}
//# sourceMappingURL=module.d.ts.map