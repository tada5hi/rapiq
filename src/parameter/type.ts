/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../constants';

export type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;
export type OnlyScalar<T> = T extends string | number | boolean | undefined | null ? T : never;
export type OnlySingleObject<T> = T extends { [key: string]: any } ? T : never;
export type OnlyObject<T> = Flatten<T> extends OnlySingleObject<Flatten<T>> ? T | Flatten<T> : never;
export type ToOneAndMany<T> = T extends Array<infer Item> ? (Item | Item[]) : (T[] | T);
export type KeyWithOptionalPrefix<T, O extends string> = T extends string ? (`${O}${T}` | T) : never;

// -----------------------------------------------------------

export type ParseOutputElementBase<K extends `${Parameter}`,
    V extends unknown | undefined = undefined,
    > =
    (K extends `${Parameter.PAGINATION}` ? Record<string, any> : {
        key: string
    }) & (K extends `${Parameter.RELATIONS}` ? Record<string, any> : {
        alias?: string
    }) & (K extends `${Parameter.FIELDS}` ? {
        value?: V
    } : {
        value: V
    });

export type ParseOptionsBase<K extends `${Parameter}`,
    A = string[],
    > = (
        K extends `${Parameter.PAGINATION}` ?
            Record<string, any> :
            {
                aliasMapping?: Record<string, string>,
                allowed?: A,
                defaultAlias?: string
            }
    ) & (
        K extends `${Parameter.PAGINATION}` | `${Parameter.RELATIONS}` ?
            Record<string, any> :
            {
                relations?: ParseOutputElementBase<Parameter.RELATIONS, string>[]
            }
    );
