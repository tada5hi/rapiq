/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PaginationOptions, RelationsOptions } from '../parameter';
import {
    FieldsOptionsContainer,
    FiltersOptionsContainer,
    SortOptionsContainer,
} from '../parameter';
import type {
    SchemaOptions,
} from './types';
import type { ObjectLiteral } from '../types';
import { normalizeSchemaOptions } from './normalize';

export class Schema<T extends ObjectLiteral = ObjectLiteral> {
    public readonly defaultPath : string | undefined;

    public readonly throwOnFailure : boolean | undefined;

    public readonly fields : FieldsOptionsContainer<T>;

    public readonly filters : FiltersOptionsContainer<T>;

    public readonly pagination : PaginationOptions;

    public readonly relations: RelationsOptions<T>;

    public readonly sort: SortOptionsContainer<T>;

    // ---------------------------------------------------------

    constructor(input: SchemaOptions<T>) {
        const options = normalizeSchemaOptions(input);

        this.defaultPath = options.defaultPath;
        this.throwOnFailure = options.throwOnFailure;

        this.fields = new FieldsOptionsContainer(options.fields);
        this.filters = new FiltersOptionsContainer(options.filters);
        this.pagination = options.pagination;
        this.relations = options.relations;
        this.sort = new SortOptionsContainer(options.sort);
    }
}
