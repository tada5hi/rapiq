/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import type { IField, IFields } from '../../../parameter';
import { Field, Fields } from '../../../parameter';
import { FieldOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';
import type { FieldsBuildInput } from './types';

/**
 * The generic-less overload comes first: without an explicit record
 * generic, input is checked against the plain-string grammar instead of
 * letting inference derive RECORD from the argument (a bare string would
 * otherwise become the record type and yield nonsense key types).
 */
export function defineFields(input: FieldsBuildInput<ObjectLiteral> | IFields) : IFields;
export function defineFields<
    RECORD extends ObjectLiteral,
>(input: FieldsBuildInput<RECORD> | IFields) : IFields;
export function defineFields(input: FieldsBuildInput<ObjectLiteral> | IFields) : IFields {
    if (isParameterNode<IFields>(input)) {
        return input;
    }

    const output : IField[] = [];
    buildFields(output, input);

    return new Fields(output);
}

function buildFields(
    output: IField[],
    input: unknown,
    prefix?: string,
) : void {
    if (typeof input === 'string') {
        for (const part of input.split(',')) {
            const name = part.trim();
            if (!name) {
                continue;
            }

            pushField(output, name, prefix);
        }

        return;
    }

    if (Array.isArray(input)) {
        // tuple form: [simple keys, relation record]
        if (
            input.length === 2 &&
            Array.isArray(input[0]) &&
            isObject(input[1])
        ) {
            buildFields(output, input[0], prefix);
            buildFields(output, input[1], prefix);

            return;
        }

        for (const element of input) {
            if (typeof element !== 'string') {
                throw BuildError.inputInvalid();
            }

            pushField(output, element, prefix);
        }

        return;
    }

    if (isObject(input)) {
        const keys = Object.keys(input);
        for (const key of keys) {
            if (typeof input[key] === 'undefined') {
                continue;
            }

            buildFields(output, input[key], prefix ? `${prefix}.${key}` : key);
        }

        return;
    }

    throw BuildError.inputInvalid();
}

function pushField(
    output: IField[],
    input: string,
    prefix?: string,
) : void {
    let name = input;
    let operator : `${FieldOperator}` | undefined;

    const character = name.substring(0, 1);
    if (
        character === FieldOperator.INCLUDE ||
        character === FieldOperator.EXCLUDE
    ) {
        operator = character;
        name = name.substring(1);
    }

    output.push(new Field(prefix ? `${prefix}.${name}` : name, operator));
}
