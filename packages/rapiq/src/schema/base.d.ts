import type { BaseSchemaOptions } from './types';
export declare class BaseSchema<OPTIONS extends BaseSchemaOptions = BaseSchemaOptions> {
    protected options: OPTIONS;
    constructor(options: OPTIONS);
    set name(input: string | undefined);
    get name(): string | undefined;
    set throwOnFailure(input: boolean | undefined);
    get throwOnFailure(): boolean | undefined;
    mapSchema(input: string): string;
}
//# sourceMappingURL=base.d.ts.map