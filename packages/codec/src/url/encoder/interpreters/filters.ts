/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, IInterpreter } from 'rapiq';
import {
    Filter,
    FilterCompoundOperator, FilterFieldOperator, Filters, URLParameter,
    renameObjectKeys, serializeAsURI,
} from 'rapiq';

export class FiltersInterpreter implements IInterpreter<Condition, string> {
    interpret(input: Condition): string {
        const output = this.visit(input);

        return serializeAsURI(output, { prefixParts: [URLParameter.FILTERS] });
    }

    protected visit(input: Condition, isRoot = true) {
        const output : Record<string, any> = {};

        if (input instanceof Filters) {
            for (let i = 0; i < input.value.length; i++) {
                let prefix : string;
                if (input.operator === FilterCompoundOperator.AND) {
                    prefix = '0';
                } else {
                    prefix = `${i}`;
                }

                const child = this.visit(input.value[i], false);
                const keys = Object.keys(child);
                for (let i = 0; i < keys.length; i++) {
                    output[prefix + keys[i]] = child[keys[i]];
                }
            }

            if (isRoot) {
                return renameObjectKeys(
                    output,
                    (key) => {
                        const match = key.match(/^(\d+)(.*)/);
                        if (match) {
                            if (input.operator === FilterCompoundOperator.AND) {
                                match[1] = match[1].substring(1);
                                if (!match[1]) {
                                    return match[2];
                                }
                            }
                            return `${match[1]}:${match[2]}`;
                        }

                        return key;
                    },
                );
            }
        }

        if (input instanceof Filter) {
            const value = this.normalizeValue(input.value);

            if (input.operator === FilterFieldOperator.EQUAL) {
                output[input.field] = value;
            } else {
                output[input.field] = input.operator + value;
            }
        }

        return output;
    }

    protected normalizeValue(input: unknown) : string | undefined {
        if (typeof input === 'string') {
            return input;
        }

        if (
            typeof input === 'undefined' ||
            input === 'null' ||
            input === null
        ) {
            return 'null';
        }

        if (typeof input === 'number') {
            return `${input}`;
        }

        if (typeof input === 'boolean') {
            return input ? 'true' : 'false';
        }

        if (input instanceof RegExp) {
            return input.source;
        }

        if (Array.isArray(input)) {
            return input
                .map((el) => this.normalizeValue(el))
                .filter(Boolean)
                .join(',');
        }

        return undefined;
    }
}
