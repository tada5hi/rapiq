/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import { ArraySerializer } from './array';
import { RecordSerializer } from './record';
import { RecordArraySerializer } from './record-array';
import type { ISerializer } from './types';

export class QuerySerializer implements ISerializer<string | null> {
    readonly fields : RecordArraySerializer;

    readonly filters : RecordSerializer;

    readonly pagination : RecordSerializer;

    readonly relations : ArraySerializer;

    readonly sorts : ArraySerializer;

    readonly groups : ArraySerializer;

    readonly aggregates : ArraySerializer;

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
        this.sorts = new ArraySerializer(
            URLParameter.SORT,
        );
        this.groups = new ArraySerializer(
            URLParameter.GROUPS,
        );
        this.aggregates = new ArraySerializer(
            URLParameter.AGGREGATES,
        );
    }

    reset() : void {
        this.fields.reset();
        this.filters.reset();
        this.pagination.reset();
        this.relations.reset();
        this.sorts.reset();
        this.groups.reset();
        this.aggregates.reset();
    }

    serialize(): string | null {
        // groups and aggregates come last, so every query without them
        // keeps its encoded string byte for byte.
        const normalized = [
            this.fields.serialize(),
            this.filters.serialize(),
            this.pagination.serialize(),
            this.relations.serialize(),
            this.sorts.serialize(),
            this.groups.serialize(),
            this.aggregates.serialize(),
        ]
            .filter(Boolean)
            .join('&');

        if (normalized.length === 0) {
            return null;
        }

        return normalized;
    }
}
