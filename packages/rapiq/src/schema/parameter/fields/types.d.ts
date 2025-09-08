import type { BaseSchemaOptions, VerifyFn } from '../../types';
import type { ObjectLiteral, SimpleKeys } from '../../../types';
export type FieldsOptions<T extends Record<string, any> = Record<string, any>, CONTEXT extends ObjectLiteral = ObjectLiteral> = BaseSchemaOptions & {
    mapping?: Record<string, string>;
    allowed?: SimpleKeys<T>[];
    default?: SimpleKeys<T>[];
    verify?: VerifyFn<string[], CONTEXT>;
};
//# sourceMappingURL=types.d.ts.map