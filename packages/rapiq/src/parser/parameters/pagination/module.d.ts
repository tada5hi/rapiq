import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';
import { PaginationSchema, Schema } from '../../../schema';
import type { PaginationParseOptions, PaginationParseOutput } from './types';
export declare class PaginationParser extends BaseParser<PaginationParseOptions, PaginationParseOutput> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: PaginationParseOptions<RECORD>): Promise<PaginationParseOutput>;
    protected finalizePagination(data: PaginationParseOutput, options: PaginationSchema): PaginationParseOutput;
    protected resolveSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD> | PaginationSchema): PaginationSchema;
}
//# sourceMappingURL=module.d.ts.map