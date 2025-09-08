import type { ObjectLiteral } from '../../../types';
import type { IBuilder } from '../../types';
import type { RelationsBuildInput } from './types';
export declare class RelationsBuilder<RECORD extends ObjectLiteral = ObjectLiteral> implements IBuilder<RelationsBuildInput<RECORD>> {
    readonly value: string[];
    constructor();
    clear(): void;
    addRaw(input: RelationsBuildInput<RECORD>): void;
    mergeWith(builder: RelationsBuilder<RECORD>): void;
    drop(input: RelationsBuildInput<RECORD> | RelationsBuilder<RECORD>): void;
    build(): string | undefined;
}
//# sourceMappingURL=module.d.ts.map