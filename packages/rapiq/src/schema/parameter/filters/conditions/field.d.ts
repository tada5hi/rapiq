import { FieldCondition as BaseFieldCondition } from '@ucast/core';
import type { FilterFieldOperator } from '../constants';
export declare class FieldCondition<VALUE = unknown, KEY extends string = string> extends BaseFieldCondition<VALUE> {
    constructor(operator: `${FilterFieldOperator}`, key: KEY, value: VALUE);
}
//# sourceMappingURL=field.d.ts.map