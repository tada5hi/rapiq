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

export type ArrayItem<Type> = Type extends Array<infer Item> ? Item : Type;

export type IsArray<Type> = Type extends Array<any> ? Type : never;
export type Scalar = string | number | boolean | undefined | null;
export type IsScalar<T> = T extends string | number | boolean | undefined | null ? T : never;

export type OnlySingleObject<T> = T extends { [key: string]: any } ? T : never;
export type OnlyObject<T> = ArrayItem<T> extends OnlySingleObject<ArrayItem<T>> ? T | ArrayItem<T> : never;
export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

export type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export type SimpleKeys<
    T extends Record<PropertyKey, any>,
> = {
    [Key in keyof T & string]: T[Key] extends Scalar | Date ? `${Key}` : never;
}[keyof T & string];

type IsRecursiveKeyValue<T> = T extends Date ?
    never :
    T extends Record<PropertyKey, any> ?
        T :
        never;

export type NestedKeys<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
    {
        [Key in keyof T & string]: T[Key] extends Array<infer ELEMENT> ?
            (
                ELEMENT extends IsRecursiveKeyValue<ELEMENT> ?
                    `${Key}.${NestedKeys<ELEMENT, PrevIndex[DEPTH]>}` :
                    `${Key}`
            ) :
            T[Key] extends IsRecursiveKeyValue<T[Key]> ?
                `${Key}.${NestedKeys<T[Key], PrevIndex[DEPTH]>}` :
                `${Key}`
    }[keyof T & string];

export type SimpleResourceKeys<
    T extends Record<PropertyKey, any>,
> = {
    [Key in keyof T & string]: T[Key] extends Array<infer ELEMENT> ?
        (
            ELEMENT extends IsRecursiveKeyValue<ELEMENT> ?
                Key :
                never
        ) :
        T[Key] extends IsRecursiveKeyValue<T[Key]> ?
            Key :
            never
}[keyof T & string];

export type NestedResourceKeys<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
    {
        [Key in keyof T & string]: T[Key] extends Array<infer ELEMENT> ?
            (
                ELEMENT extends IsRecursiveKeyValue<ELEMENT> ?
                    Key | `${Key}.${NestedResourceKeys<ELEMENT, PrevIndex[DEPTH]>}` :
                    never
            ) : T[Key] extends IsRecursiveKeyValue<T[Key]>
                ? Key | `${Key}.${NestedResourceKeys<ArrayItem<T[Key]>, PrevIndex[DEPTH]>}`
                : never
    }[keyof T & string];

export type TypeFromNestedKeyPath<
    T extends Record<PropertyKey, any>,
    Path extends string,
    Depth extends number = 4,
> = [Depth] extends [0] ? never :
    {
        [Key in Path & string]: Key extends keyof T
            ? (
                T[Key] extends Array<infer ELEMENT> ?
                    ELEMENT :
                    T[Key]
            )
            : Key extends `${infer P}.${infer S}` ?
                (P extends keyof T ?
                    T[P] extends Array<infer ELEMENT> ?
                        (
                            ELEMENT extends Record<PropertyKey, any> ?
                                TypeFromNestedKeyPath<ELEMENT, S, PrevIndex[Depth]> :
                                ELEMENT
                        ) :
                        (
                            T[P] extends Record<PropertyKey, any>
                                ? TypeFromNestedKeyPath<T[P], S, PrevIndex[Depth]>
                                : T[P]
                        )
                    : never
                ) :
                never;
    }[Path];
