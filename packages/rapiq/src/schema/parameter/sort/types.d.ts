import type { SimpleKeys } from '../../../types';
import type { SortDirection } from './constants';
import type { BaseSchemaOptions } from '../../types';
export type SortOptionDefault<T extends Record<string, any>> = {
    [K in SimpleKeys<T>]?: `${SortDirection}`;
};
export type SortOptions<T extends Record<string, any> = Record<string, any>> = BaseSchemaOptions & {
    allowed?: SimpleKeys<T>[] | SimpleKeys<T>[][];
    mapping?: Record<string, string>;
    default?: SortOptionDefault<T>;
};
//# sourceMappingURL=types.d.ts.map