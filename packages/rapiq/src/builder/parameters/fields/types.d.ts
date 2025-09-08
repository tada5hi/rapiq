import type { FieldOperator } from '../../../schema';
import type { KeyWithOptionalPrefix, NestedKeys, ObjectLiteral, PrevIndex, SimpleKeys } from '../../../types';
type FieldWithOperator<T extends string> = KeyWithOptionalPrefix<T, FieldOperator>;
export type FieldsBuildSimpleKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<SimpleKeys<T>>;
export type FieldsBuildNestedKeyInput<T extends ObjectLiteral = ObjectLiteral> = FieldWithOperator<NestedKeys<T>>;
export type FieldsBuildRecordInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ? (ELEMENT extends Record<PropertyKey, any> ? FieldsBuildInput<ELEMENT, PrevIndex[DEPTH]> : never) : T[K] extends Record<PropertyKey, any> ? FieldsBuildInput<T[K], PrevIndex[DEPTH]> : never;
};
export type FieldsBuildTupleInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : [
    FieldsBuildSimpleKeyInput<T>[],
    FieldsBuildRecordInput<T, PrevIndex[DEPTH]>
];
export type FieldsBuildInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : FieldsBuildRecordInput<T, PrevIndex[DEPTH]> | FieldsBuildTupleInput<T, PrevIndex[DEPTH]> | FieldsBuildNestedKeyInput<T>[] | FieldsBuildNestedKeyInput<T>;
export {};
//# sourceMappingURL=types.d.ts.map