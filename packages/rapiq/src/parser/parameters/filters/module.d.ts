import { FieldCondition, FilterFieldOperator, FiltersSchema, Schema } from '../../../schema';
import type { Condition } from '../../../schema';
import type { FilterValuePrimitive } from '../../../builder';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';
import type { FiltersParseOptions } from './types';
export declare class FiltersParser extends BaseParser<FiltersParseOptions, Condition> {
    preParse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: FiltersParseOptions<RECORD>): Record<string, FieldCondition[]>;
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(input: unknown, options?: FiltersParseOptions<RECORD>): Promise<Condition>;
    protected groupDefaults<RECORD extends ObjectLiteral = ObjectLiteral>(options?: FiltersParseOptions<RECORD>): Record<string, FieldCondition<unknown, string>[]>;
    protected mergeGroups(input?: Record<string, Condition[]>): Condition;
    protected parseValue(input: unknown): {
        value: unknown;
        operator: `${FilterFieldOperator}`;
    } | undefined;
    protected parseStringValue(value: string): {
        operator: `${FilterFieldOperator}`;
        value: unknown;
    };
    protected normalizeValue(input: unknown): FilterValuePrimitive | FilterValuePrimitive[];
    protected resolveSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD> | FiltersSchema<RECORD>): FiltersSchema<RECORD>;
}
//# sourceMappingURL=module.d.ts.map