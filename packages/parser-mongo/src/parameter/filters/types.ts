/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ArrayItem,
    FiltersParseOptions,
    IsArray,
    IsScalar,
    NestedKeys,
    ObjectLiteral,
    PrevIndex,
    TypeFromNestedKeyPath,
} from '@rapiq/core';

export type MongoFiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = FiltersParseOptions<RECORD>;

/**
 * Field-level operator object of the mongo dialect
 * (e.g. `{ $gte: 18, $lt: 65 }`).
 */
export type MongoFieldQueryOperators<V = unknown> = {
    $eq?: V | null,
    $ne?: V | null,
    $lt?: V,
    $lte?: V,
    $gt?: V,
    $gte?: V,
    $in?: (V | null)[],
    $nin?: (V | null)[],
    $startsWith?: string,
    $notStartsWith?: string,
    $endsWith?: string,
    $notEndsWith?: string,
    $contains?: string,
    $notContains?: string,
    $regex?: RegExp | string,
    $options?: string,
    $mod?: [number, number],
    $exists?: boolean,
    $elemMatch?: ObjectLiteral,
    $not?: Omit<MongoFieldQueryOperators<V>, '$not' | '$regex' | '$options' | '$mod' | '$elemMatch'>,
};

/**
 * Legal value shapes of one field entry — bare scalars desugar to `$eq`,
 * bare arrays to `$in`, bare RegExp instances to `$regex`.
 */
export type MongoFiltersParserInputValue<
    V,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ? never :
    V extends Array<infer ELEMENT> ?
        MongoFiltersParserInputValue<ELEMENT, PrevIndex[DEPTH]> :
        V extends Date ?
            Date | null | Array<Date | null> | MongoFieldQueryOperators<Date> :
            V extends string ?
                V | null | RegExp | Array<V | null> | MongoFieldQueryOperators<V> :
                V extends IsScalar<V> ?
                    V | null | Array<V | null> | MongoFieldQueryOperators<V> :
                    never;

type MongoFiltersParserInputSubLevel<
    T,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ? never :
    T extends IsArray<T> ?
        ArrayItem<T> extends Record<PropertyKey, any> ?
            MongoFiltersParserInput<ArrayItem<T>, PrevIndex[DEPTH]> |
            { $elemMatch?: MongoFiltersParserInput<ArrayItem<T>, PrevIndex[DEPTH]> } :
            MongoFiltersParserInputValue<ArrayItem<T>, PrevIndex[DEPTH]> :
        T extends Date ?
            MongoFiltersParserInputValue<T, PrevIndex[DEPTH]> :
            T extends Record<PropertyKey, any> ?
                MongoFiltersParserInput<T, PrevIndex[DEPTH]> :
                MongoFiltersParserInputValue<T, PrevIndex[DEPTH]>;

export type MongoFiltersParserInput<
    T extends ObjectLiteral = ObjectLiteral,
    DEPTH extends number = 10,
> = [DEPTH] extends [0] ? never :
    {
        [K in keyof T]?: MongoFiltersParserInputSubLevel<T[K], PrevIndex[DEPTH]>
    } & {
        [K in NestedKeys<T>]?: MongoFiltersParserInputValue<TypeFromNestedKeyPath<T, K>, PrevIndex[DEPTH]>
    } & {
        $and?: MongoFiltersParserInput<T, PrevIndex[DEPTH]>[],
        $or?: MongoFiltersParserInput<T, PrevIndex[DEPTH]>[],
        $nor?: MongoFiltersParserInput<T, PrevIndex[DEPTH]>[],
    };
