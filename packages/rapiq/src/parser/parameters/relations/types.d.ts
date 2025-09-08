import type { ObjectLiteral } from '../../../types';
import type { RelationsSchema, Schema } from '../../../schema';
export type RelationsParseOutput = string[];
export type RelationsParseOptions<RECORD extends ObjectLiteral = ObjectLiteral> = {
    throwOnFailure?: boolean;
    schema?: string | Schema<RECORD> | RelationsSchema<RECORD>;
};
//# sourceMappingURL=types.d.ts.map