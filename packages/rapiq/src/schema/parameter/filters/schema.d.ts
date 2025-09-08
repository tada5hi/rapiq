import type { NestedKeys, ObjectLiteral, SimpleKeys } from '../../../types';
import type { FiltersOptionDefault, FiltersOptions } from './types';
import { BaseSchema } from '../../base';
export declare class FiltersSchema<T extends ObjectLiteral = ObjectLiteral> extends BaseSchema<FiltersOptions<T>> {
    default: Record<string, any>;
    defaultIsUndefined: boolean;
    defaultKeys: string[];
    allowed: string[];
    allowedIsUndefined: boolean;
    constructor(input?: FiltersOptions<T>);
    get mapping(): Record<string, string> | undefined;
    hasDefaults(): boolean;
    validate(key: NestedKeys<T>, value: unknown): boolean;
    setDefault(input?: FiltersOptionDefault<T>): void;
    setAllowed(input?: SimpleKeys<T>[]): void;
}
//# sourceMappingURL=schema.d.ts.map