/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import { BaseKeyValidatableSchema } from '../../key-validatable';
import type { RelationsOptions, RelationsSchemaDescription } from './types';

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

    // ---------------------------------------------------------

    /**
     * Serialize the declared constraints. The array is cloned, so a
     * consumer mutating the description never touches the schema.
     * The `schemas` target map is composed by {@link Schema.describe},
     * since the schema mapping lives on the parent schema.
     */
    describe() : RelationsSchemaDescription {
        return {
            allowed: typeof this.options.allowed === 'undefined' ?
                null :
                [...this.options.allowed],
            schemas: null,
        };
    }
}
