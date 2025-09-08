import type { Condition, FiltersSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import type { RelationsParseOutput } from '../relations';
export type FiltersParseOptions<RECORD extends ObjectLiteral = ObjectLiteral> = {
    relations?: RelationsParseOutput;
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>;
    throwOnFailure?: boolean;
};
export type FiltersParseOutput = Condition;
//# sourceMappingURL=types.d.ts.map