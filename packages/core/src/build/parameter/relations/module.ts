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

export function defineRelations<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(input: RelationsBuildInput<RECORD> | IRelations) : IRelations {
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
            output.push(new Relation(prefix ? `${prefix}.${part}` : part));
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
