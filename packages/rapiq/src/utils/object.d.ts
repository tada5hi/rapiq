export declare function isObject(item: unknown): item is Record<string, any>;
export declare function renameObjectKeys(target: Record<string, any>, fn: (key: string) => string): Record<string, any>;
export declare function reduceObject(target: Record<string, any>, fn: (key: string) => boolean): Record<string, any>;
export declare function extendObject(target: Record<string, any>, source: Record<string, any>, prefix?: string): Record<string, any>;
export declare function hasOwnProperty<X extends Record<string, any>, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown>;
export declare function isPropertySet<X extends Record<string, any>, K extends keyof X>(obj: X, prop: K): boolean;
type Options = {
    transformer?: (input: unknown, key: string) => unknown | undefined;
    validator?: (input: unknown, key: string) => boolean | undefined;
};
export declare function toFlatObject(data: Record<string, any>, options?: Options): Record<string, any>;
export {};
//# sourceMappingURL=object.d.ts.map