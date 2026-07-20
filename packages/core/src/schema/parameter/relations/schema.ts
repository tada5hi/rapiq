/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { MaybeAsync, ObjectLiteral } from '../../../types';
import { BaseSchema } from '../../base';
import type { RelationsOptions } from './types';

export class RelationsSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseSchema<RelationsOptions<T, CONTEXT>> {
    get allowed() {
        return this.options.allowed;
    }

    get mapping() {
        return this.options.mapping || {};
    }

    hasValidator() {
        return typeof this.options.validate !== 'undefined';
    }

    validate(name: string, context: CONTEXT) : MaybeAsync<boolean | undefined> {
        if (typeof this.options.validate === 'undefined') {
            return true;
        }

        return this.options.validate(name, context);
    }
}
