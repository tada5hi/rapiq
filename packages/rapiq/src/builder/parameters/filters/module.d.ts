import { CompoundCondition, FieldCondition } from '../../../schema';
import type { NestedKeys, ObjectLiteral } from '../../../types';
import type { IBuilder } from '../../types';
import type { FiltersBuildInput } from './types';
export declare class FiltersBuilder<T extends ObjectLiteral = ObjectLiteral> extends CompoundCondition<FiltersBuilder<T> | FieldCondition<string, NestedKeys<T>>> implements IBuilder<FiltersBuildInput<T>> {
    addRaw(input: FiltersBuildInput<T>): void;
    mergeWith(builder: FiltersBuilder<T>): void;
    normalize(isRoot?: boolean): Record<string, any>;
    build(): string | undefined;
    protected normalizeValue(input: unknown): string | undefined;
}
//# sourceMappingURL=module.d.ts.map