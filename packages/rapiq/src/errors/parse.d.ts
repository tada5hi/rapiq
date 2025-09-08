import { BaseError } from './base';
import type { BaseErrorOptions } from './types';
export declare class ParseError extends BaseError {
    constructor(message?: string | BaseErrorOptions);
    static inputInvalid(): ParseError;
    static keyNotPermitted(name: string): ParseError;
    static keyInvalid(key: string): ParseError;
    static keyPathInvalid(key: string): ParseError;
    static keyValueInvalid(key: string): ParseError;
}
//# sourceMappingURL=parse.d.ts.map