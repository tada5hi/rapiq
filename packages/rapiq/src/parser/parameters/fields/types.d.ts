import type { ObjectLiteral } from '../../../types';
import type { FieldsSchema, Schema } from '../../../schema';
import type { RelationsParseOutput } from '../relations';
export type FieldsParseOutput = string[];
export type FieldsParseInputTransformed = {
    default: string[];
    included: string[];
    excluded: string[];
};
export type FieldsParseOptions<RECORD extends ObjectLiteral = ObjectLiteral> = {
    relations?: RelationsParseOutput;
    schema?: string | Schema<RECORD> | FieldsSchema<RECORD>;
    isChild?: boolean;
};
//# sourceMappingURL=types.d.ts.map