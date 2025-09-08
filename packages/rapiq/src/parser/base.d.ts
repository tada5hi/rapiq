import type { Schema } from '../schema';
import { SchemaRegistry } from '../schema';
import type { ObjectLiteral } from '../types';
export declare abstract class BaseParser<OPTIONS extends ObjectLiteral = ObjectLiteral, OUTPUT = any> {
    protected registry: SchemaRegistry;
    constructor(input?: SchemaRegistry);
    abstract parse(input: unknown, options: OPTIONS): Promise<OUTPUT>;
    protected getBaseSchema<RECORD extends ObjectLiteral = ObjectLiteral>(input?: string | Schema<RECORD>): Schema<RECORD>;
    protected groupObjectByBasePath<T extends Record<string, any>>(input: T): Record<string, T>;
    protected groupArrayByBasePath(input: string[]): Record<string, string[]>;
    protected groupByFieldPathWithFn(items: string[], cb: (prefix: string, key: string, index: number) => void): void;
}
//# sourceMappingURL=base.d.ts.map