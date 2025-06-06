/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import { merge, serializeAsURI, toKeyPathArray } from '../../../utils';
import { BaseBuilder } from '../../base';
import type { RelationsBuildInput } from './types';

export class RelationsBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<RelationsBuildInput<RECORD>> {
    protected items : string[];

    constructor() {
        super();

        this.items = [];
    }

    add(input: RelationsBuildInput<RECORD>) {
        this.items = merge(this.items, toKeyPathArray(input));
    }

    serialize() {
        if (this.items.length === 0) {
            return undefined;
        }

        return serializeAsURI(this.items, { prefixParts: [URLParameter.RELATIONS] });
    }
}
