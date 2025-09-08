import { ErrorCode } from './code';
import type { BaseErrorOptions } from './types';
export declare class BaseError extends Error {
    readonly code: `${ErrorCode}`;
    constructor(input: BaseErrorOptions | string);
}
//# sourceMappingURL=base.d.ts.map