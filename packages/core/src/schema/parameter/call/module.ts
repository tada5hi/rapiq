/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import { ErrorCode, ErrorMessage, SchemaError } from '../../../errors';
import {
    AGGREGATE_FUNCTION_SLOTS,
    BucketUnit,
    GROUP_FUNCTION_SLOTS,
    isBucketUnit,
} from '../../../parameter';
import type { CallSlot, CallSlotName, CallTerm } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { isObject, isPropertyNameValid, isPropertySet } from '../../../utils';
import type { AggregatesSchema } from '../aggregates';
import type { GroupsSchema } from '../groups';
import type {
    CallFunctionDescription,
    CallFunctionNormalized,
    CallResolution,
    CallSlotNormalized,
} from './types';

function isSlotValueValid(slot: CallSlotName, value: unknown) : boolean {
    if (typeof value !== 'string') {
        return false;
    }

    return slot === 'unit' ?
        isBucketUnit(value) :
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

function reject(code: `${ErrorCode}`, message: string) : CallResolution {
    return {
        success: false,
        code,
        message,
    };
}

/**
 * The primitive of that name with every slot open, or undefined. Read
 * as an own property: `constructor` must not find Object's.
 */
function resolvePrimitive(
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    name: string,
) : CallFunctionNormalized | undefined {
    const primitives : Record<string, CallSlot[]> = parameter === Parameter.GROUPS ?
        GROUP_FUNCTION_SLOTS :
        AGGREGATE_FUNCTION_SLOTS;
    const slots = isPropertySet(primitives, name) ? primitives[name] : undefined;

    return slots ? buildBuiltinFunction(name, slots, []) : undefined;
}

/**
 * Resolve one client term to what an adapter lowers.
 *
 * Bound (a schema given): only declared columns and functions resolve,
 * so a schema without a groups or aggregates block permits nothing.
 * Unbound (schemaless parse, build layer): the primitives resolve with
 * any column, a bare term is a group column, and any other callee is a
 * named function only a schema can resolve (`OPERATOR_UNSUPPORTED`).
 * The checks run in a fixed order and the first failure wins.
 * Duplicate output keys are the caller's check.
 */
export function resolveCallTerm(
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    term: CallTerm,
    schema?: GroupsSchema | AggregatesSchema,
) : CallResolution {
    const identifiers = [term.name, ...term.params];

    const dotted = identifiers.find((identifier) => identifier.includes('.'));
    if (typeof dotted !== 'undefined') {
        return reject(ErrorCode.KEY_PATH_NOT_ALLOWED, ErrorMessage.keyPathNotPermitted(dotted));
    }

    const invalid = identifiers.find((identifier) => !isPropertyNameValid(identifier));
    if (typeof invalid !== 'undefined') {
        return reject(ErrorCode.KEY_INVALID, ErrorMessage.keyInvalid(invalid));
    }

    let declaration : CallFunctionNormalized | undefined;
    if (schema) {
        declaration = isPropertySet(schema.functions, term.name) ?
            schema.functions[term.name] :
            undefined;
    } else {
        declaration = resolvePrimitive(parameter, term.name);
    }

    if (!declaration) {
        if (
            parameter === Parameter.GROUPS &&
            term.params.length === 0 &&
            // read columns only from a groups schema: an aggregates schema
            // has none, so passed here by mistake it must permit none.
            (!schema || ('allowed' in schema && schema.allowed.includes(term.name)))
        ) {
            return {
                success: true,
                lowering: {
                    fn: undefined,
                    field: term.name,
                    args: [],
                },
            };
        }

        return schema ?
            reject(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted(term.name)) :
            reject(ErrorCode.OPERATOR_UNSUPPORTED, ErrorMessage.operatorUnsupported(term.name));
    }

    const open = declaration.slots.filter((slot) => !slot.fixed);
    const required = open.filter((slot) => !slot.optional);
    if (term.params.length < required.length || term.params.length > open.length) {
        return reject(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid(term.name));
    }

    const values : Partial<Record<CallSlotName, string>> = {};
    for (const slot of declaration.slots) {
        if (slot.fixed) {
            values[slot.name] = slot.values[0];
        }
    }

    for (const [index, slot] of open.entries()) {
        const param = term.params[index];
        if (typeof param === 'undefined') {
            break;
        }

        // unbound, a field is any valid identifier; bound, one the slot lists.
        if (slot.name === 'field' && schema && !slot.values.includes(param)) {
            return reject(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted(param));
        }

        if (slot.name === 'unit' && !slot.values.includes(param)) {
            return reject(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid(term.name));
        }

        values[slot.name] = param;
    }

    return {
        success: true,
        lowering: {
            fn: declaration.fn,
            field: values.field,
            args: values.unit ? [values.unit] : [],
        },
    };
}
