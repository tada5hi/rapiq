import type { IBuilder } from '../../types';
import type { PaginationBuildInput } from './types';
export declare class PaginationBuilder implements IBuilder<PaginationBuildInput> {
    readonly value: PaginationBuildInput;
    constructor();
    clear(): void;
    addRaw(input: PaginationBuildInput): void;
    mergeWith(builder: PaginationBuilder): void;
    setLimit(input?: number): void;
    setOffset(input?: number): void;
    build(): string | undefined;
}
//# sourceMappingURL=module.d.ts.map