import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';
import { RelationsSchema, Schema } from '../../../schema';
import type { RelationsParseOptions, RelationsParseOutput } from './types';
export declare class RelationsParser extends BaseParser<RelationsParseOptions, RelationsParseOutput> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: RelationsParseOptions<RECORD>): Promise<RelationsParseOutput>;
    protected normalize(input: unknown, throwOnFailure?: boolean): string[];
    protected includeParents(data: string[]): string[];
    protected isValidPath(input: string): boolean;
    protected resolveSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD> | RelationsSchema<RECORD>): RelationsSchema<RECORD>;
}
//# sourceMappingURL=module.d.ts.map