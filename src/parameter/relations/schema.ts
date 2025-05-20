/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsOptions } from './types';
import type { ObjectLiteral } from '../../types';
import { BaseSchema } from '../../schema/base';

export class RelationsSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<RelationsOptions<T>> {
    get pathMapping() {
        return this.options.pathMapping || {};
    }

    get includeParents() {
        return this.options.includeParents ?? true;
    }

    get allowed() {
        return this.options.allowed;
    }

    get mapping() {
        return this.options.mapping || {};
    }
}
