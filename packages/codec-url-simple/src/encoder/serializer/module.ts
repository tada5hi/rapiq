/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../constants';
import { ArraySerializer } from './array';
import { RecordSerializer } from './record';
import { RecordArraySerializer } from './record-array';
import type { ISerializer } from './types';

export class QuerySerializer implements ISerializer<string | null> {
    readonly fields : RecordArraySerializer;

    readonly filters : RecordSerializer;

    readonly pagination : RecordSerializer;

    readonly relations : ArraySerializer;

    readonly sort : ArraySerializer;

    constructor() {
        this.fields = new RecordArraySerializer(
            URLParameter.FIELDS,
        );
        this.filters = new RecordSerializer(
            URLParameter.FILTERS,
        );
        this.pagination = new RecordSerializer(
            URLParameter.PAGINATION,
        );
        this.relations = new ArraySerializer(
            URLParameter.RELATIONS,
        );
        this.sort = new ArraySerializer(
            URLParameter.SORT,
        );
    }

    reset() : void {
        this.fields.reset();
        this.filters.reset();
        this.pagination.reset();
        this.relations.reset();
        this.sort.reset();
    }

    serialize(): string | null {
        const normalized = [
            this.fields.serialize(),
            this.filters.serialize(),
            this.pagination.serialize(),
            this.relations.serialize(),
            this.sort.serialize(),
        ]
            .filter(Boolean)
            .join('&');

        if (normalized.length === 0) {
            return null;
        }

        return normalized;
    }
}
