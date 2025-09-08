export declare function diffArray<T = unknown>(target: T[], src: T[]): T[];
export declare function buildKeyPath(key: string, prefix?: string): string;
type Options = {
    transformer?: (input: unknown, output: string[], prefix?: string) => boolean | undefined;
};
export declare function toKeyPathArray(input: unknown, options?: Options, prefix?: string): string[];
export declare function groupArrayByKeyPath(input: string[]): Record<string, string[]>;
export {};
//# sourceMappingURL=array.d.ts.map