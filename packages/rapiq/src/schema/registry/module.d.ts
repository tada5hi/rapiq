import { Schema } from '../module';
import type { ObjectLiteral } from '../../types';
export declare class SchemaRegistry {
    protected entities: Map<string, Schema<any>>;
    constructor();
    add<T extends ObjectLiteral>(schema: Schema<T>): void;
    drop(name: string): void;
    get<T extends ObjectLiteral = ObjectLiteral>(name: Schema<T> | string): Schema<T> | undefined;
    getOrFail<T extends ObjectLiteral = ObjectLiteral>(name: string | Schema<T>): Schema<T>;
    resolve(...input: (undefined | Schema | string)[]): Schema | undefined;
}
//# sourceMappingURL=module.d.ts.map