import { CompoundCondition as BaseCompoundCondition } from '@ucast/core';
import type { Condition } from './condition';
export declare class CompoundCondition<T extends Condition = Condition> extends BaseCompoundCondition<T> {
    add(child: T): void;
    clear(): void;
}
//# sourceMappingURL=compound.d.ts.map