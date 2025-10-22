/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IInterpreter } from 'rapiq';
import {
    DEFAULT_ID, Field, Fields, parseKey,
} from 'rapiq';

import { URLParameter } from '../../constants';
import { serializeAsURI } from '../../utils';

export class FieldsInterpreter implements IInterpreter<Fields | Field, string | null> {
    interpret(input: Fields | Field): string | null {
        const output = this.visit(input);

        const keys = Object.keys(output);
        if (keys.length === 0) {
            return null;
        }

        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return serializeAsURI(
                output[DEFAULT_ID],
                { prefixParts: [URLParameter.FIELDS] },
            );
        }

        return serializeAsURI(
            output,
            {
                prefixParts: [URLParameter.FIELDS],
            },
        );
    }

    protected visit(input: Fields | Field) : Record<string, string[]> {
        const output : Record<string, string[]> = {};

        if (input instanceof Fields) {
            for (let i = 0; i < input.value.length; i++) {
                const child = this.visit(input.value[i]);
                const keys = Object.keys(child);
                for (let i = 0; i < keys.length; i++) {
                    output[keys[i]] = child[keys[i]];
                }
            }
        }

        if (input instanceof Field) {
            const key = parseKey(input.name);

            output[key.path || DEFAULT_ID] = [input.operator + key.name];
        }

        return output;
    }
}
