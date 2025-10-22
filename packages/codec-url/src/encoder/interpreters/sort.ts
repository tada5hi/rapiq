/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IInterpreter } from 'rapiq';
import {
    Sort,
    SortDirection,
    Sorts,
} from 'rapiq';

import { URLParameter } from '../../constants';
import { serializeAsURI } from '../../utils';

export class SortsInterpreter implements IInterpreter<Sorts | Sort, string | null> {
    interpret(input: Sorts | Sort): string | null {
        const output = this.visit(input);

        return serializeAsURI(
            output,
            {
                prefixParts: [URLParameter.SORT],
            },
        );
    }

    protected visit(input: Sorts | Sort) : string[] {
        const output : string[] = [];

        if (input instanceof Sorts) {
            for (let i = 0; i < input.value.length; i++) {
                const child = this.visit(input.value[i]);

                output.push(...child);
            }
        }

        if (input instanceof Sort) {
            if (input.operator === SortDirection.DESC) {
                output.push(`-${input.name}`);
            } else {
                output.push(input.name);
            }
        }

        return output;
    }
}
