/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from '../../../utils';
import { BaseBuilder } from '../../base';
import type { PaginationBuildInput } from './types';

export class PaginationBuilder extends BaseBuilder<PaginationBuildInput> {
    protected items : PaginationBuildInput;

    constructor() {
        super();

        this.items = {};
    }

    add(input: PaginationBuildInput) {
        this.items = merge(this.items, input);
    }

    prepare(): unknown {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        return this.items;
    }
}
