/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseOutput, FiltersParseOutputElement } from '../../parser';
import type { NestedKeys, ObjectLiteral } from '../../types';
import {
    buildKeyWithPath, flattenParseAllowedOption, hasOwnProperty, parseKey, toFlatObject,
} from '../../utils';
import { FilterComparisonOperator, FilterInputOperatorValue } from './constants';
import type {
    FilterValueSimple, FiltersOptions,
} from './types';
import { BaseSchema } from '../../schema/base';

export class FiltersSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FiltersOptions<T>> {
    public default : Record<string, any>;

    public defaultKeys : string[];

    public defaultOutput : FiltersParseOutput;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: FiltersOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultKeys = [];
        this.defaultOutput = [];

        this.initDefault();
        this.initAllowed();
    }

    // ---------------------------------------------------------

    validate(key: NestedKeys<T>, value: unknown) {
        if (typeof this.options.validate === 'undefined') {
            return true;
        }

        return this.options.validate(key, value);
    }

    get mapping() {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    protected initDefault() {
        if (!this.options.default) {
            this.default = {};
            this.defaultKeys = [];
            this.defaultOutput = this.buildParseOutput();
            return;
        }

        this.default = toFlatObject(this.options.default);
        this.defaultKeys = Object.keys(this.default);
        this.defaultOutput = this.buildParseOutput();
    }

    protected initAllowed() {
        if (typeof this.options.allowed === 'undefined') {
            if (typeof this.options.default !== 'undefined') {
                const flatten = toFlatObject(this.options.default);
                const allowed = Object.keys(flatten);
                if (allowed.length > 0) {
                    this.allowed = allowed;
                    this.allowedIsUndefined = false;
                    return;
                }
            }

            this.allowed = [];
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = flattenParseAllowedOption(this.options.allowed);
        this.allowedIsUndefined = false;
    }

    public buildParseOutput(
        input: Record<string, FiltersParseOutputElement> = {},
    ) : FiltersParseOutput {
        const inputKeys = Object.keys(input || {});

        if (
            !this.options.defaultByElement &&
            inputKeys.length > 0
        ) {
            return Object.values(input);
        }

        if (this.defaultKeys.length > 0) {
            const output : FiltersParseOutput = [];

            for (let i = 0; i < this.defaultKeys.length; i++) {
                const keyDetails = parseKey(this.defaultKeys[i]);

                if (
                    this.options.defaultByElement &&
                    inputKeys.length > 0
                ) {
                    const keyWithPath = buildKeyWithPath(keyDetails);
                    if (hasOwnProperty(input, keyWithPath)) {
                        continue;
                    }
                }

                if (this.options.defaultByElement || inputKeys.length === 0) {
                    let path : string | undefined;
                    if (keyDetails.path) {
                        path = keyDetails.path;
                    } else if (this.options.defaultPath) {
                        path = this.options.defaultPath;
                    }

                    output.push(this.transformParseOutputElement({
                        ...(path ? { path } : {}),
                        key: keyDetails.name,
                        value: this.default[this.defaultKeys[i]],
                    }));
                }
            }

            return input ? [...Object.values(input), ...output] : output;
        }

        return input ? Object.values(input) : [];
    }

    // ^([0-9]+(?:\.[0-9]+)*){0,1}([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*){0,1}$
    public transformParseOutputElement(element: FiltersParseOutputElement) : FiltersParseOutputElement {
        if (
            hasOwnProperty(element, 'path') &&
            (typeof element.path === 'undefined' || element.path === null)
        ) {
            delete element.path;
        }

        if (element.operator) {
            return element;
        }

        if (typeof element.value === 'string') {
            element = {
                ...element,
                ...this.parseFilterValue(element.value),
            };
        } else {
            element.operator = FilterComparisonOperator.EQUAL;
        }

        element.value = this.transformFilterValue(element.value);

        return element;
    }

    protected transformFilterValue(input: FilterValueSimple) : FilterValueSimple {
        if (typeof input === 'string') {
            input = input.trim();
            const lower = input.toLowerCase();

            if (lower === 'true') {
                return true;
            }

            if (lower === 'false') {
                return false;
            }

            if (lower === 'null') {
                return null;
            }

            if (input.length === 0) {
                return input;
            }

            const num = Number(input);
            if (!Number.isNaN(num)) {
                return num;
            }

            const parts = input.split(',');
            if (parts.length > 1) {
                return this.transformFilterValue(parts);
            }
        }

        if (Array.isArray(input)) {
            for (let i = 0; i < input.length; i++) {
                input[i] = this.transformFilterValue(input[i]) as string | number;
            }

            return (input as unknown[])
                .filter((n) => n === 0 || n === null || !!n) as FilterValueSimple;
        }

        if (typeof input === 'undefined' || input === null) {
            return null;
        }

        return input;
    }

    protected parseFilterValue(input: FilterValueSimple) : {
        operator: `${FilterComparisonOperator}`,
        value: FilterValueSimple
    } {
        if (
            typeof input === 'string' &&
            input.includes(FilterInputOperatorValue.IN)
        ) {
            input = input.split(FilterInputOperatorValue.IN);
        }

        let negation = false;

        let value = this.matchOperator(FilterInputOperatorValue.NEGATION, input, 'start');
        if (typeof value !== 'undefined') {
            negation = true;
            input = value;
        }

        if (Array.isArray(input)) {
            return {
                value: input,
                operator: negation ?
                    FilterComparisonOperator.NOT_IN :
                    FilterComparisonOperator.IN,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LIKE, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: negation ?
                    FilterComparisonOperator.NOT_LIKE :
                    FilterComparisonOperator.LIKE,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LESS_THAN_EQUAL, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.LESS_THAN_EQUAL,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.LESS_THAN, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.LESS_THAN,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.MORE_THAN_EQUAL, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.GREATER_THAN_EQUAL,
            };
        }

        value = this.matchOperator(FilterInputOperatorValue.MORE_THAN, input, 'start');
        if (typeof value !== 'undefined') {
            return {
                value,
                operator: FilterComparisonOperator.GREATER_THAN,
            };
        }

        return {
            value: input,
            operator: negation ?
                FilterComparisonOperator.NOT_EQUAL :
                FilterComparisonOperator.EQUAL,
        };
    }

    protected matchOperator(key: string, value: FilterValueSimple, position: 'start' | 'end' | 'global') : FilterValueSimple | undefined {
        if (typeof value === 'string') {
            switch (position) {
                case 'start': {
                    if (value.substring(0, key.length) === key) {
                        return value.substring(key.length);
                    }
                    break;
                }
                case 'end': {
                    if (value.substring(0 - key.length) === key) {
                        return value.substring(0, value.length - key.length - 1);
                    }
                    break;
                }
            }

            return undefined;
        }

        if (Array.isArray(value)) {
            let match = false;
            for (let i = 0; i < value.length; i++) {
                const output = this.matchOperator(key, value[i], position);
                if (typeof output !== 'undefined') {
                    match = true;
                    value[i] = output as string | number;
                }
            }

            if (match) {
                return value;
            }
        }

        return undefined;
    }
}
