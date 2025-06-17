/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../types';
import { isPropertySet } from '../utils';
import type { SchemaOptions, SchemaOptionsNormalized } from './types';

function setIfNotDefined<
    T extends ObjectLiteral,
    K extends keyof T,
>(input: T, key: K, value: T[K]) {
    if (!isPropertySet(input, key)) {
        input[key] = value;
    }
}

export function normalizeSchemaOptions<
    T extends ObjectLiteral = ObjectLiteral,
>(input: SchemaOptions<T>) : SchemaOptionsNormalized<T> {
    const output : SchemaOptionsNormalized<T> = {
        ...input,
        fields: input.fields || {},
        filters: input.filters || {},
        pagination: input.pagination || {},
        relations: input.relations || {},
        sort: input.sort || {},
    };

    if (isPropertySet(input, 'name')) {
        setIfNotDefined(output.fields, 'name', input.name);
        setIfNotDefined(output.filters, 'name', input.name);
        setIfNotDefined(output.sort, 'name', input.name);
    }

    if (isPropertySet(input, 'throwOnFailure')) {
        setIfNotDefined(output.fields, 'throwOnFailure', input.throwOnFailure);
        setIfNotDefined(output.filters, 'throwOnFailure', input.throwOnFailure);
        setIfNotDefined(output.pagination, 'throwOnFailure', input.throwOnFailure);
        setIfNotDefined(output.relations, 'throwOnFailure', input.throwOnFailure);
        setIfNotDefined(output.sort, 'throwOnFailure', input.throwOnFailure);
    }

    return output;
}
