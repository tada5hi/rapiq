/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../parameter/filters/condition';
import { FilterFieldOperator } from '../schema';
import { Filters, isFilters } from '../parameter/filters/collection';
import { Filter, isFilter } from '../parameter/filters/record';
import { isObject } from '../utils';
import { IR_HOST_REF_KEY } from './constants';
import type { ConditionIR, IRValueRef } from './types';

/**
 * The values of one IR exchange that JSON cannot carry faithfully. Encoding
 * replaces each with an {@link IRValueRef}; decoding swaps the original back
 * in, so identity and exact JavaScript semantics survive the round trip.
 *
 * Two modes for objects:
 * - `plain` (default, for transport): plain objects (prototype `Object` or
 *   `null`) stay JSON, their members encoded in turn; the IR then is plain
 *   JSON as long as no value needs a reference.
 * - `reference` (the in-process path to the Rust binding): every object is
 *   a reference, which keeps identity and anything nested JSON would lose.
 */
export class IRValueTable {
    readonly values : unknown[] = [];

    readonly objects : 'plain' | 'reference';

    constructor(options: { objects?: 'plain' | 'reference' } = {}) {
        this.objects = options.objects ?? 'plain';
    }

    /**
     * JSON primitives and arrays stay plain (array items are encoded in
     * turn; `undefined` becomes `null`, JSON's single absent value), plain
     * objects too in `plain` mode. Everything else becomes a reference.
     */
    encode(value: unknown) : unknown {
        if (value === undefined || value === null) {
            return null;
        }

        if (typeof value === 'string' || typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            // -0 has no JSON form: transport writes 0 (as JSON.stringify
            // does), the in-process path keeps it exact as a reference
            if (!Object.is(value, -0) || this.objects === 'plain') {
                return Object.is(value, -0) ? 0 : value;
            }
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.encode(item));
        }

        if (this.objects === 'plain' && isPlainObject(value)) {
            const output : Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                output[key] = this.encode(item);
            }

            return output;
        }

        return this.reference(value);
    }

    /**
     * Swap references back to the original values (recursing into
     * arrays, the only containers that stay plain).
     */
    decode(value: unknown) : unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.decode(item));
        }

        if (isObject(value)) {
            if (typeof value[IR_HOST_REF_KEY] === 'number') {
                return this.values[value[IR_HOST_REF_KEY] as number];
            }

            const output : Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                output[key] = this.decode(item);
            }

            return output;
        }

        return value;
    }

    protected reference(value: unknown) : IRValueRef {
        let index = this.values.findIndex((entry) => Object.is(entry, value));
        if (index === -1) {
            index = this.values.length;
            this.values.push(value);
        }

        const ref : IRValueRef = {
            [IR_HOST_REF_KEY]: index,
            type: this.typeOf(value),
            text: this.textOf(value),
            truthy: !!value,
        };

        if (typeof value === 'number' && Number.isFinite(value)) {
            // only -0 reaches here: finite, but not representable in JSON
            ref.number = 0;
        }

        if (value instanceof RegExp) {
            ref.source = value.source;
            ref.flags = value.flags;
        }

        if (isObject(value) && typeof value.operator === 'string') {
            ref.operator = value.operator;
        }

        return ref;
    }

    protected typeOf(value: unknown) : string {
        if (value instanceof Date) {
            return 'date';
        }

        if (value instanceof RegExp) {
            return 'regexp';
        }

        return typeof value;
    }

    protected textOf(value: unknown) : string {
        try {
            return String(value);
        } catch {
            // an object without a usable toString (Object.create(null))
            return '[object Object]';
        }
    }
}

/**
 * Serialize a condition tree into the IR. Values JSON cannot carry
 * faithfully are recorded in `table` and replaced by references; a
 * condition kind the IR cannot express becomes a `custom` node.
 */
export function toIR(input: ICondition, table: IRValueTable = new IRValueTable()) : ConditionIR {
    if (isFilters(input)) {
        return {
            type: 'filters',
            operator: input.operator,
            value: input.value
                // holes in a compound are skipped, as by every consumer
                .filter((child) => !!child)
                .map((child) => toIR(child, table)),
        };
    }

    if (isFilter(input)) {
        const value = input.operator === FilterFieldOperator.ELEM_MATCH && isBuiltIn(input.value) ?
            toIR(input.value, table) :
            table.encode(input.value);

        return {
            type: 'filter',
            operator: input.operator,
            field: input.field,
            value,
        };
    }

    const operator = (input as Partial<ICondition> | undefined)?.operator;

    return typeof operator === 'string' ?
        { type: 'custom', operator } :
        { type: 'custom' };
}

/**
 * Rebuild built-in conditions from the IR. References resolve through
 * `table`; a `custom` node cannot be rebuilt and throws.
 */
export function fromIR(input: ConditionIR, table: IRValueTable = new IRValueTable()) : ICondition {
    if (input.type === 'filters') {
        return new Filters(input.operator, input.value.map((child) => fromIR(child, table)));
    }

    if (input.type === 'custom') {
        throw new TypeError(`The custom condition ${input.operator ?? ''} has no IR form to rebuild from.`);
    }

    const value = input.operator === FilterFieldOperator.ELEM_MATCH && isNodeIR(input.value) ?
        fromIR(input.value, table) :
        table.decode(input.value);

    return new Filter(input.operator, input.field, value);
}

function isPlainObject(input: unknown) : input is Record<string, unknown> {
    if (!isObject(input)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(input);

    return prototype === Object.prototype || prototype === null;
}

function isBuiltIn(input: unknown) : input is ICondition {
    return isFilter(input as ICondition) || isFilters(input as ICondition);
}

function isNodeIR(input: unknown) : input is ConditionIR {
    const type = isObject(input) ? input.type : undefined;

    return type === 'filter' || type === 'filters' || type === 'custom';
}
