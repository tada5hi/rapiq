/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SortDirection } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { extendObject, isObject, toFlatObject } from '../../../utils';
import { BaseBuilder } from '../../base';
import type { SortBuildInput } from './types';

export class SortBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<SortBuildInput<RECORD>> {
    protected items : Record<string, SortDirection>;

    constructor() {
        super();

        this.items = {};
    }

    add(input: SortBuildInput<RECORD>) {
        const record = this.transformInput(input);
        const keys = Object.keys(record);
        for (let i = 0; i < keys.length; i++) {
            this.items[keys[i]] = record[keys[i]];
        }
    }

    prepare(): unknown {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        const parts : string[] = [];

        for (let i = 0; i < keys.length; i++) {
            parts.push((this.items[keys[i]] === SortDirection.DESC ? '-' : '') + keys[i]);
        }

        return parts;
    }

    protected transformInput(input: SortBuildInput<any>) : Record<string, SortDirection> {
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
                    ...this.transformInput(input[i]),
                };
            }

            return output;
        }

        if (isObject(input)) {
            return toFlatObject(input, {
                transformer: (input, output) => {
                    if (isObject(input)) {
                        const tmp = this.transformInput(input as SortBuildInput<any>);
                        extendObject(output, tmp);

                        return true;
                    }

                    return undefined;
                },
            });
        }

        return {};
    }
}
