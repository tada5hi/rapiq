/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLFilterOperator } from '@rapiq/parser-simple';
import type { Condition, IInterpreter } from 'rapiq';
import {
    Filter,
    FilterFieldOperator,
    Filters,
} from 'rapiq';

import { URLParameter } from '../../constants';
import { serializeAsURI } from '../../utils';

export class FiltersInterpreter implements IInterpreter<Condition, string> {
    interpret(input: Condition): string {
        const output = this.visit(input);

        return serializeAsURI(output, { prefixParts: [URLParameter.FILTERS] });
    }

    protected visit(input: Condition) {
        const output : Record<string, any> = {};

        if (input instanceof Filters) {
            for (let i = 0; i < input.value.length; i++) {
                const child = this.visit(input.value[i]);
                const keys = Object.keys(child);
                for (let i = 0; i < keys.length; i++) {
                    output[keys[i]] = child[keys[i]];
                }
            }
        }

        if (input instanceof Filter) {
            const [key, value] = this.visitFilter(input);

            output[key] = value;
        }

        return output;
    }

    protected visitFilter(filter: Filter): [string, string] {
        const normalized = this.normalizeValue(filter.value);

        if (
            filter.operator === FilterFieldOperator.NOT_EQUAL ||
            filter.operator === FilterFieldOperator.NOT_IN
        ) {
            return [
                filter.field,
                URLFilterOperator.NEGATION + normalized,
            ];
        }

        if (filter.operator === FilterFieldOperator.LESS_THAN) {
            return [
                filter.field,
                URLFilterOperator.LESS_THAN + normalized,
            ];
        }

        if (filter.operator === FilterFieldOperator.LESS_THAN_EQUAL) {
            return [
                filter.field,
                URLFilterOperator.LESS_THAN_EQUAL + normalized,
            ];
        }

        if (filter.operator === FilterFieldOperator.GREATER_THAN) {
            return [
                filter.field,
                URLFilterOperator.GREATER_THAN + normalized,
            ];
        }

        if (filter.operator === FilterFieldOperator.GREATER_THAN_EQUAL) {
            return [
                filter.field,
                URLFilterOperator.GREATER_THAN_EQUAL + normalized,
            ];
        }

        // todo: like missing

        return [filter.field, normalized];
    }

    protected normalizeValue(input: unknown) : string {
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

        throw new Error('Value can not be normalized');
    }
}
