/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsInputTransformed } from '../type';
import { FieldOperator } from '../constants';

export function transformFieldsInput(fields: string[]): FieldsInputTransformed {
    const output: FieldsInputTransformed = {
        default: [],
        included: [],
        excluded: [],
    };

    for (let i = 0; i < fields.length; i++) {
        let operator: FieldOperator | undefined;

        if (fields[i].substring(0, 1) === FieldOperator.INCLUDE) {
            operator = FieldOperator.INCLUDE;
        } else if (fields[i].substring(0, 1) === FieldOperator.EXCLUDE) {
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

export function parseFieldsInput(data: unknown): string[] {
    const valuePrototype: string = Object.prototype.toString.call(data);
    if (
        valuePrototype !== '[object Array]' &&
        valuePrototype !== '[object String]'
    ) {
        return [];
    }

    let fieldsArr: string[] = [];

    /* istanbul ignore next */
    if (valuePrototype === '[object String]') {
        fieldsArr = (data as string).split(',');
    }

    /* istanbul ignore next */
    if (valuePrototype === '[object Array]') {
        fieldsArr = (data as unknown[])
            .filter((val) => typeof val === 'string') as string[];
    }

    return fieldsArr;
}
