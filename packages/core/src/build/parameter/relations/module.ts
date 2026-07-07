/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import type { IRelation, IRelations } from '../../../parameter';
import { Relation, Relations } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';
import type { RelationsBuildInput } from './types';

/**
 * The generic-less overload comes first: without an explicit record
 * generic, input is checked against the plain-string grammar instead of
 * letting inference derive RECORD from the argument (a bare string would
 * otherwise become the record type and yield nonsense key types).
 */
export function defineRelations(input: RelationsBuildInput<ObjectLiteral> | IRelations) : IRelations;
export function defineRelations<
    RECORD extends ObjectLiteral,
>(input: RelationsBuildInput<RECORD> | IRelations) : IRelations;
export function defineRelations(input: RelationsBuildInput<ObjectLiteral> | IRelations) : IRelations {
    if (isParameterNode<IRelations>(input)) {
        return input;
    }

    const output : IRelation[] = [];
    buildRelations(output, input);

    return new Relations(output);
}

function buildRelations(
    output: IRelation[],
    input: unknown,
    prefix?: string,
) : void {
    if (typeof input === 'string') {
        for (const part of input.split(',')) {
            const name = part.trim();
            if (!name) {
                continue;
            }

            output.push(new Relation(prefix ? `${prefix}.${name}` : name));
        }

        return;
    }

    if (Array.isArray(input)) {
        for (const element of input) {
            if (typeof element !== 'string') {
                throw BuildError.inputInvalid();
            }

            output.push(new Relation(prefix ? `${prefix}.${element}` : element));
        }

        return;
    }

    if (isObject(input)) {
        const keys = Object.keys(input);
        for (const key of keys) {
            const value = input[key];
            if (typeof value === 'undefined' || value === false) {
                continue;
            }

            const path = prefix ? `${prefix}.${key}` : key;

            if (value === true) {
                output.push(new Relation(path));
                continue;
            }

            buildRelations(output, value, path);
        }

        return;
    }

    throw BuildError.inputInvalid();
}
