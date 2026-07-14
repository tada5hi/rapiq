/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilter } from '../../../parameter';
import type {
    MaybeAsync,
    ObjectLiteral, 
    SimpleKeys,
} from '../../../types';
import type { BaseSchemaOptions } from '../../types';

export type Validator = (input: IFilter) => MaybeAsync<IFilter | undefined | void>;

export type FiltersOptions<
    T extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: ICondition,
    validate?: Validator,
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default —
     * e.g. identifier or token columns. Keys are resolved names
     * (after mapping), matching the entries of `allowed`.
     */
    caseSensitive?: SimpleKeys<T>[],
};
