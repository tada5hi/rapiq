/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ObjectLiteral = Record<string, any>;
export type ObjectLiteralKeys<T extends ObjectLiteral> = {
    [K in keyof T as `${K & (string | number)}`]: T[K];
};

export type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;
export type OnlyScalar<T> = T extends string | number | boolean | undefined | null ? T : never;
export type OnlySingleObject<T> = T extends { [key: string]: any } ? T : never;
export type OnlyObject<T> = Flatten<T> extends OnlySingleObject<Flatten<T>> ? T | Flatten<T> : never;
export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export type SimpleKeys<T> =
    T extends ObjectLiteral ?
        (
            {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
                ? (Flatten<T[Key]> extends Date ? `${Key}` : never)
                : `${Key}`
            }[keyof T & (string | number)]
        ) : string;

export type NestedKeys<T, Depth extends number = 4> =
    T extends ObjectLiteral ?
        (
            [Depth] extends [0] ? never :
                {
                    [Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
                        ? (Flatten<T[Key]> extends Date ? `${Key}` : `${Key}.${NestedKeys<Flatten<T[Key]>, PrevIndex[Depth]>}`)
                        : `${Key}`
                }[keyof T & string]
        ) : string;

export type ResourceKeys<T> =
    T extends ObjectLiteral ?
        {
            [Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any> ?
                Key : never
        }[keyof T & (string | number)]
        : string;

export type NestedResourceKeys<T, Depth extends number = 4> =
    T extends ObjectLiteral ?
        (
            [Depth] extends [0] ? never :
                {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
                    ? Key | `${Key}.${NestedResourceKeys<Flatten<T[Key]>, PrevIndex[Depth]>}`
                    : never
                }[keyof T & (string | number)]
        ) : string;

export type TypeFromNestedKeyPath<
    T,
    Path extends string,
> = T extends ObjectLiteral ? {
    [K in Path]: K extends keyof T
        ? Flatten<T[K]>
        : K extends `${infer P}.${infer S}`
            ? Flatten<T[P]> extends Record<string, any>
                ? TypeFromNestedKeyPath<Flatten<T[P]>, S>
                : never
            : never;
}[Path] : never;
