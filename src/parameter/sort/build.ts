/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import type { SortBuildInput } from './types';
import { SortDirection } from './types';
import {
    extendObject,
    isObject,
    toFlatObject,
} from '../../utils';

export function transformSortBuildInput(input: SortBuildInput<any>) : Record<string, SortDirection> {
    if (typeof input === 'undefined') {
        return {};
    }

    if (typeof input === 'string') {
        return input.split(',')
            .reduce((acc, curr) => {
                if (curr.startsWith('-')) {
                    acc[curr.slice(1)] = SortDirection.DESC;
                } else {
                    acc[curr] = SortDirection.ASC;
                }

                return acc;
            }, {} as Record<string, SortDirection>);
    }

    if (Array.isArray(input)) {
        let output : Record<string, SortDirection> = {};
        for (let i = 0; i < input.length; i++) {
            output = {
                ...output,
                ...transformSortBuildInput(input[i]),
            };
        }

        return output;
    }

    if (isObject(input)) {
        return toFlatObject(input, {
            transformer: (input, output) => {
                if (isObject(input)) {
                    const tmp = transformSortBuildInput(input as SortBuildInput<any>);
                    extendObject(output, tmp);

                    return true;
                }

                return undefined;
            },
        });
    }

    return {};
}
