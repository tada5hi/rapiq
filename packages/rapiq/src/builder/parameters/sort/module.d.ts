import { SortDirection } from '../../../schema';
import type { NestedKeys, ObjectLiteral, SimpleKeys } from '../../../types';
import type { IBuilder } from '../../types';
import type { SortBuildInput } from './types';
export declare class SortBuilder<RECORD extends ObjectLiteral = ObjectLiteral> implements IBuilder<SortBuildInput<RECORD>> {
    readonly value: Record<string, `${SortDirection}`>;
    constructor();
    clear(): void;
    addRaw(input: SortBuildInput<RECORD>): void;
    mergeWith(builder: SortBuilder<RECORD>): void;
    set(key: SimpleKeys<RECORD> | NestedKeys<RECORD>, value: `${SortDirection}`): void;
    unset(key: SimpleKeys<RECORD>): void;
    protected transformInput(input: unknown): Record<string, unknown>;
    build(): string | undefined;
}
//# sourceMappingURL=module.d.ts.map