import type { FieldsParseOutput, FiltersParseOutput, PaginationParseOutput, RelationsParseOutput, SortParseOutput } from './parameters';
import { BaseParser } from './base';
import { FieldsParser, FiltersParser, PaginationParser, RelationsParser, SortParser } from './parameters';
import type { ObjectLiteral } from '../types';
import type { ParseOptions, ParseOutput, QueryParseParameterOptions } from './types';
import type { SchemaRegistry } from '../schema';
export declare class Parser extends BaseParser<ParseOptions, ParseOutput> {
    protected fieldsParser: FieldsParser;
    protected filtersParser: FiltersParser;
    protected paginationParser: PaginationParser;
    protected relationsParser: RelationsParser;
    protected sortParser: SortParser;
    constructor(input?: SchemaRegistry);
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: ParseOptions<RECORD>): Promise<ParseOutput>;
    /**
     * Parse relations input parameter.
     *
     * @param input
     * @param options
     */
    parseRelations<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: QueryParseParameterOptions<RECORD>): Promise<RelationsParseOutput>;
    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param options
     */
    parseFields<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: QueryParseParameterOptions<RECORD>): Promise<FieldsParseOutput>;
    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param options
     */
    parseFilters<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: QueryParseParameterOptions<RECORD>): Promise<FiltersParseOutput>;
    /**
     * Parse pagination input parameter.
     *
     * @param input
     * @param options
     */
    parsePagination<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: QueryParseParameterOptions<RECORD>): Promise<PaginationParseOutput>;
    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param options
     */
    parseSort<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: QueryParseParameterOptions<RECORD>): Promise<SortParseOutput>;
    protected skipParameter(input?: boolean): boolean;
    protected hasParameterData(input: Record<string, any>, keys: string[]): boolean;
    protected hasParameterOptionDefault(input: Record<string, any>): boolean;
}
//# sourceMappingURL=module.d.ts.map