/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import { groupArrayByKeyPath, merge, toKeyPathArray } from '../../../utils';
import { BaseBuilder } from '../../base';
import type { FieldsBuildInput } from './types';

export class FieldsBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<FieldsBuildInput<RECORD>> {
    protected items : Record<string, string[]>;

    constructor() {
        super();

        this.items = {};
    }

    add(input: FieldsBuildInput<RECORD>) {
        this.items = merge(this.items, groupArrayByKeyPath(toKeyPathArray(input)));
    }

    prepare(): unknown {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return this.items[DEFAULT_ID];
        }

        return this.items;
    }
}
