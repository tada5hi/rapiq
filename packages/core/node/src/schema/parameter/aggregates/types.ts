/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAggregate } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import type {
    AggregateFunctionDeclaration,
    CallBuiltinDeclaration,
    CallFunctionDescription,
    CallValidator,
} from '../call';

/**
 * What a client may aggregate. Aggregates have no bare columns: every
 * term is a call, so the whole declaration is `functions`.
 */
export type AggregatesOptions<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = {
    name?: string,
    /**
     * `count` / `sum` take the built-in form (`{ allowed }`); any other
     * key declares a named function binding one of them.
     */
    functions?: Record<string, CallBuiltinDeclaration<T> | AggregateFunctionDeclaration<T>>,
    /**
     * Dynamic per-aggregate gate, run once per resolved aggregate. See
     * {@link CallValidator}.
     */
    validate?: CallValidator<IAggregate, CONTEXT>,
};

/**
 * JSON-serializable snapshot of the aggregate constraints. `null`
 * (never declared) means nothing is permitted.
 */
export type AggregatesSchemaDescription = {
    functions: Record<string, CallFunctionDescription> | null,
};
