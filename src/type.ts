/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;
export type OnlyScalar<T> = T extends string | number | boolean | undefined | null ? T : never;
export type OnlySingleObject<T> = T extends { [key: string]: any } ? T : never;
export type OnlyObject<T> = Flatten<T> extends OnlySingleObject<Flatten<T>> ? T | Flatten<T> : never;
export type ToOneAndMany<T> = T extends Array<infer Item> ? (Item | Item[]) : (T[] | T);
export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

export type SimpleKeys<T extends Record<string, any>> =
    {[Key in keyof T & (string | number)]: T[Key] extends Record<string, any>
        ? never
        : `${Key}`
    }[keyof T & (string | number)];

export type NestedKeys<T extends Record<string, any>> =
    {[Key in keyof T & (string | number)]: Flatten<T[Key]> extends Record<string, any>
        ? `${Key}.${NestedKeys<Flatten<T[Key]>>}`
        : `${Key}`
    }[keyof T & (string | number)];

export type NestedResourceKeys<T extends Record<string, any>> =
    {[Key in keyof T & (string | number)]: T[Key] extends Record<string, any>
        ? Key | `${Key}.${NestedKeys<T[Key]>}`
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

export type OnlySimpleNestedKeys<
    T extends Record<string, any>,
    Path extends string,
    > = {
        [K in Path]: K extends keyof T
            ? K
            : K extends `${infer P}.${infer S}.${infer U}`
                ? OnlySimpleNestedKeys<T[K], `${S}.${U}`>
                : K extends `${infer P}.${infer S}` ?
                    `${P}.${S}` :
                    never;
    }[Path];
