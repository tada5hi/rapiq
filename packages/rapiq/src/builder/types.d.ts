import type { Parameter } from '../constants';
import type { ObjectLiteral, ObjectLiteralKeys } from '../types';
import type { FieldsBuildInput, FiltersBuildInput, PaginationBuildInput, RelationsBuildInput, SortBuildInput } from './parameters';
export type BuildInput<T extends ObjectLiteral> = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: FieldsBuildInput<T>;
    [Parameter.FILTERS]?: FiltersBuildInput<T>;
    [Parameter.RELATIONS]?: RelationsBuildInput<T>;
    [Parameter.PAGINATION]?: PaginationBuildInput;
    [Parameter.SORT]?: SortBuildInput<T>;
}>;
export interface IBuilder<INPUT = unknown> {
    addRaw(input: INPUT): void;
    clear(): void;
    mergeWith(builder: this): void;
    build(): string | undefined;
}
//# sourceMappingURL=types.d.ts.map