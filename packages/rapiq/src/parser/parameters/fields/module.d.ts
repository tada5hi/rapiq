import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';
import { FieldsSchema, Schema } from '../../../schema';
import type { FieldsParseOptions, FieldsParseOutput } from './types';
export declare class FieldsParser extends BaseParser<FieldsParseOptions, FieldsParseOutput> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: FieldsParseOptions<RECORD>): Promise<FieldsParseOutput>;
    protected normalize(input: unknown, throwOnFailure?: boolean): Record<string, string[]>;
    protected resolveSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD> | FieldsSchema<RECORD>): FieldsSchema<RECORD>;
}
//# sourceMappingURL=module.d.ts.map