/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { BaseSchema } from '../../base';
import type { RelationsOptions } from './types';

export class RelationsSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<RelationsOptions<T>> {
    get allowed() {
        return this.options.allowed;
    }

    get mapping() {
        return this.options.mapping || {};
    }
}
