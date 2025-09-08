import { FieldsBuilder, FiltersBuilder, PaginationBuilder, RelationsBuilder, SortBuilder } from './parameters';
import type { BuildInput, IBuilder } from './types';
import type { ObjectLiteral } from '../types';
export declare class Builder<T extends ObjectLiteral = ObjectLiteral> implements IBuilder<BuildInput<T>> {
    fields: FieldsBuilder<T>;
    filters: FiltersBuilder<T>;
    pagination: PaginationBuilder;
    relations: RelationsBuilder<T>;
    sort: SortBuilder<T>;
    constructor();
    clear(): void;
    addRaw(input: BuildInput<T>): void;
    mergeWith(builder: Builder<T>): void;
    toString(): string;
    build(): string;
}
//# sourceMappingURL=module.d.ts.map