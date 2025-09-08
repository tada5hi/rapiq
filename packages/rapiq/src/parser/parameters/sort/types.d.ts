import type { Schema, SortDirection, SortSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { RelationsParseOutput } from '../relations';
export type SortParseOutput = Record<string, `${SortDirection}`>;
export type SortParseOptions<RECORD extends ObjectLiteral = ObjectLiteral> = {
    relations?: RelationsParseOutput;
    throwOnFailure?: boolean;
    schema?: string | Schema<RECORD> | SortSchema<RECORD>;
};
//# sourceMappingURL=types.d.ts.map