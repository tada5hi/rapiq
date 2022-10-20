/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ObjectLiteral = Record<string, any>;
export type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;
export type OnlyScalar<T> = T extends string | number | boolean | undefined | null ? T : never;
export type OnlySingleObject<T> = T extends { [key: string]: any } ? T : never;
export type OnlyObject<T> = Flatten<T> extends OnlySingleObject<Flatten<T>> ? T | Flatten<T> : never;
export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export type SimpleKeys<T extends Record<string, any>> =
    {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
        ? (Flatten<T[Key]> extends Date ? `${Key}` : never)
        : `${Key}`
    }[keyof T & (string | number)];

export type NestedKeys<T extends Record<string, any>, Depth extends number = 4> =
    [Depth] extends [0] ? never :
        {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
            ? (Flatten<T[Key]> extends Date ? `${Key}` : `${Key}.${NestedKeys<Flatten<T[Key]>, PrevIndex[Depth]>}`)
            : `${Key}`
        }[keyof T & (string | number)];

export type NestedResourceKeys<T extends Record<string, any>, Depth extends number = 4> =
    [Depth] extends [0] ? never :
        {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
            ? Key | `${Key}.${NestedResourceKeys<Flatten<T[Key]>, PrevIndex[Depth]>}`
            : never
        }[keyof T & (string | number)];

export type TypeFromNestedKeyPath<
    T extends Record<string, any>,
    Path extends string,
    > = {
        [K in Path]: K extends keyof T
            ? Flatten<T[K]>
            : K extends `${infer P}.${infer S}`
                ? Flatten<T[P]> extends Record<string, any>
                    ? TypeFromNestedKeyPath<Flatten<T[P]>, S>
                    : never
                : never;
    }[Path];
