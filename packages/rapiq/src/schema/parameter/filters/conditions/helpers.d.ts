import { CompoundCondition } from './compound';
import type { Condition } from './condition';
export declare function isCompoundCondition(condition: Condition, operator?: string): condition is CompoundCondition;
export declare function flattenConditions<T extends Condition>(conditions: T[], operator: string, aggregatedResult?: T[]): T[];
export declare function optimizedCompoundCondition<T extends Condition>(operator: string, conditions: T[]): T | CompoundCondition<T>;
//# sourceMappingURL=helpers.d.ts.map