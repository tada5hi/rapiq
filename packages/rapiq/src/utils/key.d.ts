export type KeyDetails = {
    name: string;
    group?: string;
    path?: string;
};
export declare const KEY_REGEX: RegExp;
export declare function parseKey(input: string): KeyDetails;
export declare function stringifyKey(key: KeyDetails): string;
//# sourceMappingURL=key.d.ts.map