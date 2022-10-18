/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Flatten, NestedResourceKeys, OnlyObject } from '../../type';

// -----------------------------------------------------------
// Build
// -----------------------------------------------------------

export type RelationsBuildInput<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        RelationsBuildInput<Flatten<T[K]>> | boolean :
        never
} | NestedResourceKeys<T>[];

// -----------------------------------------------------------
// Parse
// -----------------------------------------------------------

export type RelationsParseOptions<
    T extends Record<string, any> = Record<string, any>,
    > = {
        allowed?: NestedResourceKeys<T>[],
        // maps input name to local name
        mapping?: Record<string, string>,
        // set alternate value for relation key.
        pathMapping?: Record<string, string>,
        defaultAlias?: string,
        includeParents?: boolean | string[] | string
    };

export type RelationsParseOutputElement = {
    key: string,
    value: string
};
export type RelationsParseOutput = RelationsParseOutputElement[];
