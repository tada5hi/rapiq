/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFields, IQuery } from '@rapiq/core';
import { Field, Fields, Query } from '@rapiq/core';

/**
 * Drop the visibility conditions of a decoded field set.
 *
 * The schema-aware encode pass runs its own output through the
 * schema-bound decoder, which re-invokes the schema's `fields.validate`
 * hook, and a hook may answer with an `ICondition`. That verdict is an
 * *acceptance*: the field stays requestable, its value is merely gated
 * on the rows the condition matches. The wire the server would accept
 * therefore still names the field, so the validation round trip must
 * discard the gate it just derived instead of tripping the encoder's
 * condition guard on it.
 *
 * Conditions on the *caller's* input query are a different matter and
 * stay a hard encode failure (see the fields visitor).
 *
 * @param input
 */
export function stripFieldConditions(input: IFields) : IFields {
    let gated = false;

    const value = input.value.map((field) => {
        if (typeof field.condition === 'undefined') {
            return field;
        }

        gated = true;

        return new Field(field.name, field.operator);
    });

    if (!gated) {
        return input;
    }

    return new Fields(value);
}

/**
 * {@link stripFieldConditions} for a whole decoded query.
 *
 * @param input
 */
export function stripQueryFieldConditions(input: IQuery) : IQuery {
    const fields = stripFieldConditions(input.fields);
    if (fields === input.fields) {
        return input;
    }

    return new Query({
        fields,
        filters: input.filters,
        pagination: input.pagination,
        relations: input.relations,
        sorts: input.sorts,
    });
}
