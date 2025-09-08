import type { ObjectLiteral } from '../../../types';
import { Schema, SortDirection, SortSchema } from '../../../schema';
import { BaseParser } from '../../base';
import type { SortParseOptions, SortParseOutput } from './types';
export declare class SortParser extends BaseParser<SortParseOptions, SortParseOutput> {
    protected buildDefaults<RECORD extends ObjectLiteral = ObjectLiteral>(options?: SortParseOptions<RECORD>): SortParseOutput;
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: SortParseOptions<RECORD>): Promise<SortParseOutput>;
    /**
     * Return input normalized as
     * [KEY]: DIRECTION
     *
     * @param input
     * @param throwOnFailure
     */
    protected normalize(input: unknown, throwOnFailure?: boolean): Record<string, SortDirection>;
    protected isMultiDimensionalArray(arr: string[] | string[][]): arr is string[][];
    protected resolveSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD> | SortSchema<RECORD>): SortSchema<RECORD>;
}
//# sourceMappingURL=module.d.ts.map