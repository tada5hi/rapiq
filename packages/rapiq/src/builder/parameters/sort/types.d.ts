import type { SortDirection } from '../../../schema';
import type { KeyWithOptionalPrefix, NestedKeys, PrevIndex, SimpleKeys } from '../../../types';
type SortWithOperator<T extends string> = KeyWithOptionalPrefix<T, '-'>;
type SortBuildRecordInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ? (ELEMENT extends Record<PropertyKey, any> ? SortBuildInput<ELEMENT, PrevIndex[DEPTH]> : `${SortDirection}`) : T[K] extends Record<PropertyKey, any> ? SortBuildInput<T[K], PrevIndex[DEPTH]> : `${SortDirection}`;
};
export type SortBuildInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : SortBuildRecordInput<T, PrevIndex[DEPTH]> | [
    SortWithOperator<SimpleKeys<T>>[],
    SortBuildRecordInput<T, PrevIndex[DEPTH]>
] | SortWithOperator<NestedKeys<T>>[] | SortWithOperator<NestedKeys<T>>;
export {};
//# sourceMappingURL=types.d.ts.map