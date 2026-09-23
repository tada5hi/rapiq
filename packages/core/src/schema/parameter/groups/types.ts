/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IGroup } from '../../../parameter';
import type { ObjectLiteral, SimpleKeys } from '../../../types';
import type {
    CallBuiltinDeclaration,
    CallFunctionDescription,
    CallValidator,
    GroupFunctionDeclaration,
} from '../call';

/**
 * What a client may group by. There is no mapping, default or failure
 * policy: named functions are the renaming mechanism, a rejection is
 * always fatal, and a bound schema permits nothing it does not declare.
 */
export type GroupsOptions<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> = {
    name?: string,
    /**
     * Root columns the client may group by as written (`group=status`).
     */
    allowed?: SimpleKeys<T>[],
    /**
     * `bucket` takes the built-in form (`{ allowed }`); any other key
     * declares a named function binding `bucket`.
     */
    functions?: Record<string, CallBuiltinDeclaration<T> | GroupFunctionDeclaration<T>>,
    /**
     * Dynamic per-group gate, run once per resolved group. See
     * {@link CallValidator}.
     */
    validate?: CallValidator<IGroup, CONTEXT>,
};

/**
 * JSON-serializable snapshot of the group constraints. Unlike the
 * other parameters, `null` (never declared) means nothing is permitted.
 */
export type GroupsSchemaDescription = {
    allowed: string[] | null,
    functions: Record<string, CallFunctionDescription> | null,
};
