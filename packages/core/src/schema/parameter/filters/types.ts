/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, Filter } from '../../../parameter';
import type {
    MaybeAsync,
    ObjectLiteral, SimpleKeys,
} from '../../../types';
import type { BaseSchemaOptions } from '../../types';

export type Validator = (input: Filter) => MaybeAsync<Filter | undefined | void>;

export type FiltersOptions<
    T extends ObjectLiteral = ObjectLiteral,
> = BaseSchemaOptions & {
    mapping?: Record<string, string>,
    allowed?: SimpleKeys<T>[],
    default?: Condition,
    validate?: Validator
};
