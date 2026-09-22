/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../../errors';
import { BucketUnit } from '../../../parameter';
import type { CallSlot, CallSlotName } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { isObject, isPropertyNameValid } from '../../../utils';
import type {
    CallFunctionDescription,
    CallFunctionNormalized,
    CallSlotNormalized,
} from './types';

function isSlotValueValid(slot: CallSlotName, value: unknown) : boolean {
    if (typeof value !== 'string') {
        return false;
    }

    return slot === 'unit' ?
        (Object.values(BucketUnit) as string[]).includes(value) :
        isPropertyNameValid(value);
}

/**
 * A primitive with every slot open: `field` limited to the given
 * columns (an empty list permits none), `unit` to the closed
 * {@link BucketUnit} set.
 */
function buildBuiltinFunction(
    fn: string,
    slots: CallSlot[],
    fields: string[],
) : CallFunctionNormalized {
    return {
        fn,
        slots: slots.map((slot) => ({
            name: slot.name,
            values: slot.name === 'unit' ? Object.values(BucketUnit) : [...fields],
            fixed: false,
            optional: slot.optional,
        })),
    };
}

function normalizeBuiltin(
    key: string,
    slots: CallSlot[],
    declaration: ObjectLiteral,
) : CallFunctionNormalized {
    if (Object.keys(declaration).some((name) => name !== 'allowed')) {
        throw SchemaError.functionInvalid(key, 'a built-in function takes only allowed');
    }

    const allowed : unknown = declaration.allowed ?? [];
    if (!Array.isArray(allowed)) {
        throw SchemaError.functionInvalid(key, 'allowed is not an array');
    }

    for (const value of allowed) {
        if (!isSlotValueValid('field', value)) {
            throw SchemaError.functionInvalid(key, `the slot field value ${String(value)} is invalid`);
        }
    }

    return buildBuiltinFunction(key, slots, allowed);
}

function normalizeNamed(
    key: string,
    primitives: Record<string, CallSlot[]>,
    declaration: ObjectLiteral,
) : CallFunctionNormalized {
    const names = Object.keys(primitives);
    const { fn } : { fn?: unknown } = declaration;
    const slots = typeof fn === 'string' && names.includes(fn) ? primitives[fn] : undefined;
    if (typeof fn !== 'string' || !slots) {
        throw SchemaError.functionInvalid(key, `fn must be one of ${names.join(', ')}`);
    }

    for (const name of Object.keys(declaration)) {
        if (name !== 'fn' && slots.every((slot) => slot.name !== name)) {
            throw SchemaError.functionInvalid(key, `the slot ${name} is unknown`);
        }
    }

    const output : CallSlotNormalized[] = [];
    for (const slot of slots) {
        const value : unknown = declaration[slot.name];
        if (typeof value === 'undefined') {
            if (slot.optional) {
                continue;
            }

            throw SchemaError.functionInvalid(key, `the slot ${slot.name} is missing`);
        }

        const values : unknown[] = Array.isArray(value) ? [...value] : [value];
        if (values.length === 0) {
            throw SchemaError.functionInvalid(key, `the slot ${slot.name} is empty`);
        }

        for (const item of values) {
            if (!isSlotValueValid(slot.name, item)) {
                throw SchemaError.functionInvalid(key, `the slot ${slot.name} value ${String(item)} is invalid`);
            }
        }

        output.push({
            name: slot.name,
            values: values as string[],
            fixed: !Array.isArray(value),
            optional: false,
        });
    }

    return { fn, slots: output };
}

/**
 * Normalize a `functions` declaration against the primitive slot
 * table of its parameter (`GROUP_FUNCTION_SLOTS`,
 * `AGGREGATE_FUNCTION_SLOTS`). A key naming a primitive takes the
 * built-in form; any other key binds a primitive, fixing a slot with
 * a scalar or opening it to the client with an array. `columns` are
 * the bare group columns a function name must not shadow.
 *
 * Throws on the first invalid declaration: a schema is developer
 * input, and a half-applied declaration would change what clients
 * may request without anyone noticing.
 */
export function normalizeCallFunctions(
    primitives: Record<string, CallSlot[]>,
    input: Record<string, ObjectLiteral> | undefined,
    columns: string[] = [],
) : Record<string, CallFunctionNormalized> {
    const output : Record<string, CallFunctionNormalized> = {};
    if (typeof input === 'undefined') {
        return output;
    }

    const names = Object.keys(primitives);

    for (const [key, declaration] of Object.entries(input)) {
        if (!isPropertyNameValid(key)) {
            throw SchemaError.functionInvalid(key, 'the name is not a valid identifier');
        }

        if (columns.includes(key)) {
            throw SchemaError.functionInvalid(key, 'it shadows the column of the same name');
        }

        if (!isObject(declaration)) {
            throw SchemaError.functionInvalid(key, 'the declaration is not an object');
        }

        const slots = names.includes(key) ? primitives[key] : undefined;
        output[key] = slots ?
            normalizeBuiltin(key, slots, declaration) :
            normalizeNamed(key, primitives, declaration);
    }

    return output;
}

/**
 * Serialize normalized functions for `describe()`. Arrays are cloned,
 * so a consumer mutating the description never touches the schema.
 */
export function describeCallFunctions(
    input: Record<string, CallFunctionNormalized>,
) : Record<string, CallFunctionDescription> {
    const output : Record<string, CallFunctionDescription> = {};

    for (const [key, { fn, slots }] of Object.entries(input)) {
        output[key] = {
            fn,
            params: slots
                .filter((slot) => !slot.fixed)
                .map((slot) => ({
                    name: slot.name, 
                    values: [...slot.values], 
                    optional: slot.optional, 
                })),
        };
    }

    return output;
}
