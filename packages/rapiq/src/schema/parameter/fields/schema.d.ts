import type { ObjectLiteral, SimpleKeys } from '../../../types';
import type { FieldsOptions } from './types';
import { BaseSchema } from '../../base';
export declare class FieldsSchema<RECORD extends ObjectLiteral = ObjectLiteral, CONTEXT extends ObjectLiteral = ObjectLiteral> extends BaseSchema<FieldsOptions<RECORD, CONTEXT>> {
    default: string[];
    defaultIsUndefined: boolean;
    allowed: string[];
    allowedIsUndefined: boolean;
    reverseMapping: Record<string, string>;
    constructor(input?: FieldsOptions<RECORD, CONTEXT>);
    /**
     * Check whether all fields are denied.
     */
    get allDenied(): boolean;
    get mapping(): Record<string, string> | undefined;
    setDefault(input?: SimpleKeys<RECORD>[]): void;
    setAllowed(input?: SimpleKeys<RECORD>[]): void;
    hasDefaults(): boolean;
    /**
     * Check whether a name exists for a group.
     *
     * @param name
     */
    isValid(name: string): boolean;
    protected initReverseMapping(): void;
    private buildReverseRecord;
}
//# sourceMappingURL=schema.d.ts.map