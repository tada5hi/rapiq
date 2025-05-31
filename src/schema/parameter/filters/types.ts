/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterValue } from '../../../builder';
import type {
    Flatten, NestedKeys, ObjectLiteral, OnlyObject, TypeFromNestedKeyPath,
} from '../../../types';
import type { OptionAllowed } from '../../../utils';
import type { BaseSchemaOptions } from '../../types';

export type FiltersOptionDefault<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FiltersOptionDefault<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

export type FiltersOptionValidator<K extends string> = (key: K, value: unknown) => boolean;

export type FiltersOptions<
    T extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: OptionAllowed<T>,
    default?: FiltersOptionDefault<T>,
    validate?: FiltersOptionValidator<NestedKeys<T>>
};
