import type { ObjectLiteral } from '../../../types';
import type { IBuilder } from '../../types';
import type { FieldsBuildInput, FieldsBuildTupleInput } from './types';
export declare class FieldsBuilder<RECORD extends ObjectLiteral = ObjectLiteral> implements IBuilder<FieldsBuildInput<RECORD>> {
    readonly value: Record<string, string[]>;
    constructor();
    clear(): void;
    addRaw(input: FieldsBuildInput<RECORD>): void;
    mergeWith(builder: FieldsBuilder<RECORD>): void;
    build(): string | undefined;
    protected isTupleInput(input: unknown): input is FieldsBuildTupleInput<RECORD>;
}
//# sourceMappingURL=module.d.ts.map