/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    AggregateFunction,
    BucketUnit,
    CallLowering,
    CallSlotName,
    GroupFunction,
} from '../../../parameter';
import type { ErrorCode } from '../../../errors';
import type { MaybeAsync, ObjectLiteral, SimpleKeys } from '../../../types';
import type { KeyValidationVerdict } from '../../types';

/**
 * One argument slot of a named function. A scalar is fixed by the
 * schema, so the client passes nothing for it; an array is open, and
 * the client picks one of the listed values.
 */
export type CallSlotValue<V extends string> = V | V[];

/**
 * The built-in form, keyed by the primitive's own name (`bucket`,
 * `count`, `sum`): the root columns the primitive may be called on.
 * Omitted means none, so `count: {}` permits `count()` only.
 */
export type CallBuiltinDeclaration<T extends ObjectLiteral = ObjectLiteral> = {
    allowed?: SimpleKeys<T>[],
};

/**
 * A named group function binding `bucket`, e.g.
 * `period: { fn: 'bucket', field: 'createdAt', unit: ['hour', 'day'] }`
 * which the client calls as `period(day)`.
 */
export type GroupFunctionDeclaration<T extends ObjectLiteral = ObjectLiteral> = {
    fn: `${GroupFunction.BUCKET}`,
    field: CallSlotValue<SimpleKeys<T>>,
    unit: CallSlotValue<`${BucketUnit}`>,
};

/**
 * A named aggregate binding `count` or `sum`. A `count` without `field`
 * counts rows.
 */
export type AggregateFunctionDeclaration<T extends ObjectLiteral = ObjectLiteral> = {
    fn: `${AggregateFunction.COUNT}`,
    field?: CallSlotValue<SimpleKeys<T>>,
} | {
    fn: `${AggregateFunction.SUM}`,
    field: CallSlotValue<SimpleKeys<T>>,
};

export type CallSlotNormalized = {
    name: CallSlotName,
    /**
     * Permitted values; exactly one when fixed.
     */
    values: string[],
    fixed: boolean,
    /**
     * Open slot the client may omit (built-in count's field only).
     */
    optional: boolean,
};

export type CallFunctionNormalized = {
    fn: string,
    /**
     * Primitive slot order. A slot a named declaration leaves out
     * (count without field) is absent.
     */
    slots: CallSlotNormalized[],
};

export type CallParamDescription = {
    name: CallSlotName,
    values: string[],
    optional: boolean,
};

/**
 * `params` lists the OPEN slots in wire order; fixed slots are the
 * schema's business and are not shown.
 */
export type CallFunctionDescription = {
    fn: string,
    params: CallParamDescription[],
};

/**
 * The verdict for one client term: what an adapter lowers, or the
 * issue a parse records (code and message, never a thrown error).
 */
export type CallResolution = {
    success: true,
    lowering: CallLowering,
} | {
    success: false,
    code: `${ErrorCode}`,
    message: string,
};

/**
 * Dynamic per-term gate of the groups and aggregates parameters, e.g. an
 * actor permission check. Runs once per resolved term with its node (`key`,
 * `name`, `params`, `lowering`) and the parse context (`undefined` when the
 * caller supplied none). Return a truthy value to accept the term; `false` or
 * `undefined` rejects it, and like every rejection of these parameters that
 * fails the parse (`ErrorCode.KEY_VALIDATE_REJECTED`) whatever the failure
 * policy. A term is not a row set, so an `ICondition` answer counts as a
 * rejection. A Promise requires the `parseAsync()` / `decodeAsync()` entry
 * points.
 */
export type CallValidator<NODE, CONTEXT = any> = (
    node: NODE,
    context: CONTEXT,
) => MaybeAsync<KeyValidationVerdict>;
