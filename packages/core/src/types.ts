/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ObjectLiteral = Record<string, any>;
export type ObjectLiteralKeys<T extends Record<PropertyKey, any>> = {
    [K in keyof T as `${K & string}`]: T[K];
};

export type MaybeAsync<T> = T | Promise<T>;

export type ArrayItem<Type> = Type extends Array<infer Item> ? Item : Type;

export type IsArray<Type> = Type extends Array<any> ? Type : never;
export type Scalar = string | number | boolean | undefined | null;
export type IsScalar<T> = T extends string | number | boolean | undefined | null ? T : never;

export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

export type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * A property counts as a leaf when it is scalar-like (Scalar, Date) or an
 * index-signature record with no known literal keys (e.g. a JSON column
 * typed Record<string, any>). `null`/`undefined` are stripped before the
 * structural checks so nullable/optional columns resolve like their
 * non-nullable counterparts.
 */
type IsLeafKeyValue<T> = T extends Scalar | Date ?
    T :
    T extends Record<PropertyKey, any> ?
        string extends keyof T ?
            T :
            never :
        never;

export type SimpleKeys<
    T extends Record<PropertyKey, any>,
> = {
    [Key in keyof T & string]: NonNullable<T[Key]> extends IsLeafKeyValue<NonNullable<T[Key]>> ?
        `${Key}` :
        never;
}[keyof T & string];

/**
 * The keys of `T` that are explicitly declared, with the `string`/`number`
 * index signatures of a "bag" type stripped out. A pure `Record<string, any>`
 * has none; an entity that merely *carries* an index signature (e.g.
 * `{ id: string; name: string; [key: string]: any }`) still keeps its literal
 * keys. Relies on a homomorphic mapped type iterating the declared members, so
 * the `as`-filter removes the index signature without collapsing the literals.
 */
type KnownKeys<T> = keyof {
    [K in keyof T as string extends K ? never : number extends K ? never : K]: 0
};

/**
 * A property is traversed as a nested branch only when it is a record with
 * known literal keys. Index-signature records (e.g. JSON columns typed
 * Record<string, any>) stay leaves — recursing into them would produce
 * unbounded `${string}` key unions.
 */
type IsRecursiveKeyValue<T> = T extends Date ?
    never :
    T extends Record<PropertyKey, any> ?
        string extends keyof T ?
            never :
            T :
        never;

/**
 * A property is a *resource* (relation target) when it is a record that carries
 * at least one explicitly-declared key. Proper records qualify, and so does an
 * entity that additionally carries a dynamic-attribute index signature (see
 * #789) — the bag guard {@link IsRecursiveKeyValue} still stops the recursion,
 * but it must not drop the relation key itself. A pure index-signature bag
 * (`Record<string, any>`, e.g. a JSON column) has no declared structure and is
 * therefore not a relation — it stays a leaf field.
 */
type IsRecordKeyValue<T> = T extends Date ?
    never :
    T extends Record<PropertyKey, any> ?
        [KnownKeys<T>] extends [never] ?
            never :
            T :
        never;

export type NestedKeys<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
    {
        [Key in keyof T & string]: NonNullable<T[Key]> extends Array<infer ELEMENT> ?
            (
                NonNullable<ELEMENT> extends IsRecursiveKeyValue<NonNullable<ELEMENT>> ?
                    `${Key}.${NestedKeys<NonNullable<ELEMENT>, PrevIndex[DEPTH]>}` :
                    `${Key}`
            ) :
            NonNullable<T[Key]> extends IsRecursiveKeyValue<NonNullable<T[Key]>> ?
                `${Key}.${NestedKeys<NonNullable<T[Key]>, PrevIndex[DEPTH]>}` :
                `${Key}`
    }[keyof T & string];

export type SimpleResourceKeys<
    T extends Record<PropertyKey, any>,
> = {
    [Key in keyof T & string]: NonNullable<T[Key]> extends Array<infer ELEMENT> ?
        (
            NonNullable<ELEMENT> extends IsRecordKeyValue<NonNullable<ELEMENT>> ?
                Key :
                never
        ) :
        NonNullable<T[Key]> extends IsRecordKeyValue<NonNullable<T[Key]>> ?
            Key :
            never
}[keyof T & string];

export type NestedResourceKeys<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
    {
        [Key in keyof T & string]: NonNullable<T[Key]> extends Array<infer ELEMENT> ?
            (
                NonNullable<ELEMENT> extends IsRecordKeyValue<NonNullable<ELEMENT>> ?
                    (
                        NonNullable<ELEMENT> extends IsRecursiveKeyValue<NonNullable<ELEMENT>> ?
                            Key | `${Key}.${NestedResourceKeys<NonNullable<ELEMENT>, PrevIndex[DEPTH]>}` :
                            Key
                    ) :
                    never
            ) : NonNullable<T[Key]> extends IsRecordKeyValue<NonNullable<T[Key]>> ?
                (
                    NonNullable<T[Key]> extends IsRecursiveKeyValue<NonNullable<T[Key]>> ?
                        Key | `${Key}.${NestedResourceKeys<ArrayItem<NonNullable<T[Key]>>, PrevIndex[DEPTH]>}` :
                        Key
                ) :
                never
    }[keyof T & string];

export type TypeFromNestedKeyPath<
    T extends Record<PropertyKey, any>,
    Path extends string,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
    {
        [Key in Path & string]: Key extends keyof T ?
            (
                NonNullable<T[Key]> extends Array<infer ELEMENT> ?
                    ELEMENT :
                    T[Key]
            ) :
            Key extends `${infer P}.${infer S}` ?
                (P extends keyof T ?
                    (
                        NonNullable<T[P]> extends Array<infer ELEMENT> ?
                            (
                                NonNullable<ELEMENT> extends Record<PropertyKey, any> ?
                                    TypeFromNestedKeyPath<NonNullable<ELEMENT>, S, PrevIndex[DEPTH]> :
                                    never
                            ) :
                            NonNullable<T[P]> extends Record<PropertyKey, any> ?
                                TypeFromNestedKeyPath<NonNullable<T[P]>, S, PrevIndex[DEPTH]> :
                                never
                    ) :
                    never
                ) :
                never;
    }[Path];
