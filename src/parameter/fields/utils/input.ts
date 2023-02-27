/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldsInputTransformed } from '../type';
import { FieldOperator } from '../constants';

export function removeFieldInputOperator(field: string) {
    const firstCharacter = field.substring(0, 1);

    return firstCharacter === FieldOperator.INCLUDE ||
        firstCharacter === FieldOperator.EXCLUDE ?
        field.substring(1) :
        field;
}

export function transformFieldsInput(
    fields: string[],
): FieldsInputTransformed {
    const output: FieldsInputTransformed = {
        default: [],
        included: [],
        excluded: [],
    };

    for (let i = 0; i < fields.length; i++) {
        let operator: FieldOperator | undefined;

        const character = fields[i].substring(0, 1);

        if (character === FieldOperator.INCLUDE) {
            operator = FieldOperator.INCLUDE;
        } else if (character === FieldOperator.EXCLUDE) {
            operator = FieldOperator.EXCLUDE;
        }

        if (operator) {
            fields[i] = fields[i].substring(1);

            switch (operator) {
                case FieldOperator.INCLUDE: {
                    output.included.push(fields[i]);
                    break;
                }
                case FieldOperator.EXCLUDE: {
                    output.excluded.push(fields[i]);
                    break;
                }
            }
        } else {
            output.default.push(fields[i]);
        }
    }

    return output;
}

export function parseFieldsInput(input: unknown): string[] {
    let output: string[] = [];

    if (typeof input === 'string') {
        output = input.split(',');
    } else if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            if (typeof input[i] === 'string') {
                output.push(input[i]);
            }
        }
    }

    return output;
}
