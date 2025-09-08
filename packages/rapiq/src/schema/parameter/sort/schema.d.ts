import type { ObjectLiteral } from '../../../types';
import type { SortOptions } from './types';
import { BaseSchema } from '../../base';
export declare class SortSchema<T extends ObjectLiteral = ObjectLiteral> extends BaseSchema<SortOptions<T>> {
    default: Record<string, any>;
    defaultKeys: string[];
    defaultIsUndefined: boolean;
    allowed: string[] | string[][];
    allowedIsUndefined: boolean;
    constructor(input?: SortOptions<T>);
    get mapping(): Record<string, string> | undefined;
    protected buildDefault(): void;
    protected buildAllowed(): void;
}
//# sourceMappingURL=schema.d.ts.map