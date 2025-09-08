import { FilterCompoundOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { FiltersBuilder } from './module';
import type { FiltersBuildInput, FiltersBuilderArg } from './types';
export declare function filters<T extends ObjectLiteral = ObjectLiteral>(input?: FiltersBuildInput<T>): FiltersBuilder<T>;
export declare function and<T extends FiltersBuilder = FiltersBuilder>(items: T[]): FiltersBuilder<FiltersBuilderArg<T>>;
export declare function or<T extends FiltersBuilder = FiltersBuilder>(items: T[]): FiltersBuilder<FiltersBuilderArg<T>>;
export declare function defineCompoundCondition<T extends FiltersBuilder = FiltersBuilder, A extends FiltersBuilderArg<T> = FiltersBuilderArg<T>>(operator: `${FilterCompoundOperator}`, items: T[]): FiltersBuilder<A>;
//# sourceMappingURL=define.d.ts.map