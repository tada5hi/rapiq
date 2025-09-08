import type { ObjectLiteral } from '../../../types';
import { BaseSchema } from '../../base';
import type { RelationsOptions } from './types';
export declare class RelationsSchema<T extends ObjectLiteral = ObjectLiteral> extends BaseSchema<RelationsOptions<T>> {
    get allowed(): import("../../../types").SimpleResourceKeys<T>[] | undefined;
    get mapping(): Record<string, string>;
}
//# sourceMappingURL=schema.d.ts.map