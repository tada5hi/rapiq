import type { SimpleResourceKeys } from '../../../types';
import type { BaseSchemaOptions } from '../../types';
export type RelationsOptions<T extends Record<string, any> = Record<string, any>> = BaseSchemaOptions & {
    allowed?: SimpleResourceKeys<T>[];
    includeParents?: boolean | string[] | string;
    mapping?: Record<string, string>;
    pathMapping?: Record<string, string>;
};
//# sourceMappingURL=types.d.ts.map