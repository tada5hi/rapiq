/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import { BaseKeyValidatableSchema } from '../../key-validatable';
import type { RelationsOptions } from './types';

export class RelationsSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseKeyValidatableSchema<RelationsOptions<T, CONTEXT>> {
    constructor(input: RelationsOptions<T, CONTEXT> = {}) {
        super(input, Parameter.RELATIONS);
    }

    get allowed() {
        return this.options.allowed;
    }

    get mapping() {
        return this.options.mapping || {};
    }
}
