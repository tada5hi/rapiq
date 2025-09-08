import type { NestedResourceKeys, PrevIndex } from '../../../types';
export type RelationsBuildInput<T extends Record<PropertyKey, any>, DEPTH extends number = 5> = [DEPTH] extends [0] ? never : {
    [K in keyof T & string]?: T[K] extends Array<infer ELEMENT> ? (ELEMENT extends Record<PropertyKey, any> ? RelationsBuildInput<ELEMENT, PrevIndex[DEPTH]> | boolean : never) : T[K] extends Record<PropertyKey, any> ? RelationsBuildInput<T[K], PrevIndex[DEPTH]> | boolean : never;
} | NestedResourceKeys<T>[] | NestedResourceKeys<T>;
//# sourceMappingURL=types.d.ts.map