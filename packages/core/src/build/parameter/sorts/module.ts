/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError } from '../../../errors';
import type { ISort, ISorts } from '../../../parameter';
import { Sort, Sorts } from '../../../parameter';
import { SortDirection } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';
import type { SortsBuildInput } from './types';

export function defineSorts<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(input: SortsBuildInput<RECORD> | ISorts) : ISorts {
    if (isParameterNode<ISorts>(input)) {
        return input;
    }

    const output : ISort[] = [];
    buildSorts(output, input);

    return new Sorts(output);
}

function buildSorts(
    output: ISort[],
    input: unknown,
    prefix?: string,
) : void {
    if (typeof input === 'string') {
        for (const part of input.split(',')) {
            pushSort(output, part, prefix);
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
            buildSorts(output, input[0], prefix);
            buildSorts(output, input[1], prefix);

            return;
        }

        for (const element of input) {
            if (typeof element !== 'string') {
                throw BuildError.inputInvalid();
            }

            pushSort(output, element, prefix);
        }

        return;
    }

    if (isObject(input)) {
        const keys = Object.keys(input);
        for (const key of keys) {
            const value = input[key];
            if (typeof value === 'undefined') {
                continue;
            }

            const path = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'string') {
                const lowered = value.toLowerCase();
                if (lowered !== 'asc' && lowered !== 'desc') {
                    throw BuildError.keyInvalid(key);
                }

                output.push(new Sort(
                    path,
                    lowered === 'desc' ? SortDirection.DESC : SortDirection.ASC,
                ));

                continue;
            }

            buildSorts(output, value, path);
        }

        return;
    }

    throw BuildError.inputInvalid();
}

function pushSort(
    output: ISort[],
    input: string,
    prefix?: string,
) : void {
    let name = input;
    let direction : SortDirection = SortDirection.ASC;

    if (name.substring(0, 1) === '-') {
        direction = SortDirection.DESC;
        name = name.substring(1);
    }

    output.push(new Sort(prefix ? `${prefix}.${name}` : name, direction));
}
