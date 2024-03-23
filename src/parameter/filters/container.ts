/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import {
    buildKeyWithPath, hasOwnProperty, parseKey, toFlatObject,
} from '../../utils';
import { flattenParseAllowedOption } from '../utils';
import { FilterComparisonOperator } from './constants';
import type {
    FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement,
} from './type';
import { parseFilterValue, transformFilterValue } from './utils';

export class FiltersOptionsContainer<T extends ObjectLiteral = ObjectLiteral> {
    public options : FiltersParseOptions<T>;

    public default : Record<string, any>;

    public defaultKeys : string[];

    public defaultOutput : FiltersParseOutput;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    constructor(input: FiltersParseOptions<T> = {}) {
        this.options = input;

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultKeys = [];
        this.defaultOutput = [];

        this.initDefault();
        this.initAllowed();
    }

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
                ...parseFilterValue(element.value),
            };
        } else {
            element.operator = FilterComparisonOperator.EQUAL;
        }

        element.value = transformFilterValue(element.value);

        return element;
    }
}
