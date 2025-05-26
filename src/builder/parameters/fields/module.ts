/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID, URLParameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import {
    groupArrayByKeyPath, merge, serializeAsURI, toKeyPathArray,
} from '../../../utils';
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

    serialize() {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return serializeAsURI(this.items[keys[0]], { prefixParts: [URLParameter.FIELDS] });
        }

        return serializeAsURI(this.items, { prefixParts: [URLParameter.FIELDS] });
    }
}
