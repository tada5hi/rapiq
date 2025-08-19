/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import { serializeAsURI, toKeyPathArray } from '../../../utils';

import type { IBuilder } from '../../types';
import type { RelationsBuildInput } from './types';

export class RelationsBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<RelationsBuildInput<RECORD>> {
    public readonly value : string[];

    constructor() {
        this.value = [];
    }

    clear() {
        for (let i = this.value.length - 1; i === 0; i--) {
            this.value.splice(i, 1);
        }
    }

    addRaw(input: RelationsBuildInput<RECORD>) {
        const normalized = toKeyPathArray(input);
        for (let i = 0; i < normalized.length; i++) {
            const index = this.value.indexOf(normalized[i]);
            if (index === -1) {
                this.value.push(normalized[i]);
            }
        }
    }

    mergeWith(builder: RelationsBuilder<RECORD>) {
        for (let i = 0; i < builder.value.length; i++) {
            const index = this.value.indexOf(builder.value[i]);
            if (index === -1) {
                this.value.push(builder.value[i]);
            }
        }
    }

    drop(input: RelationsBuildInput<RECORD> | RelationsBuilder<RECORD>) {
        if (input instanceof RelationsBuilder) {
            this.drop(input.value as RelationsBuildInput<RECORD>);
            return;
        }

        const normalized = toKeyPathArray(input);
        for (let i = 0; i < normalized.length; i++) {
            const index = this.value.indexOf(normalized[i]);
            if (index !== -1) {
                this.value.splice(i, 1);
            }
        }
    }

    build(): string | undefined {
        if (this.value.length === 0) {
            return undefined;
        }

        return serializeAsURI(this.value, { prefixParts: [URLParameter.RELATIONS] });
    }
}
