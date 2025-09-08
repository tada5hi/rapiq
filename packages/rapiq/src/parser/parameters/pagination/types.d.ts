import type { ObjectLiteral } from '../../../types';
import type { PaginationSchema, Schema } from '../../../schema';
export type PaginationParseOutput = {
    limit?: number;
    offset?: number;
};
export type PaginationParseOptions<RECORD extends ObjectLiteral = ObjectLiteral> = {
    schema?: string | Schema<RECORD> | PaginationSchema;
};
//# sourceMappingURL=types.d.ts.map