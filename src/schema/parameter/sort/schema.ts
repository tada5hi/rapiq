/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortParseOutput } from '../../../parser';
import type { ObjectLiteral } from '../../../types';
import {
    flattenParseAllowedOption,
    parseKey, toFlatObject,
} from '../../../utils';
import type {
    SortOptions,
} from './types';
import { BaseSchema } from '../../base';

export class SortSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<SortOptions<T>> {
    public default : Record<string, any>;

    public defaultKeys : string[];

    public defaultOutput : SortParseOutput;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: SortOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultKeys = [];
        this.defaultOutput = {};

        this.buildDefaultDomainFields();
        this.buildAllowedDomainFields();
    }

    // ---------------------------------------------------------

    get mapping() : Record<string, string> | undefined {
        return this.options.mapping;
    }

    get allowedRaw() {
        return this.options.allowed;
    }

    // ---------------------------------------------------------

    protected buildDefaultDomainFields() {
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

    protected buildAllowedDomainFields() {
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

    buildParseOutput() : SortParseOutput {
        if (this.default) {
            const output : SortParseOutput = {};

            const flatten = toFlatObject(this.default);
            const keys = Object.keys(flatten);

            for (let i = 0; i < keys.length; i++) {
                const fieldDetails = parseKey(keys[i]);

                let path : string | undefined;
                if (fieldDetails.path) {
                    path = fieldDetails.path;
                } else if (this.options.name) {
                    path = this.options.name;
                }

                if (path) {
                    output[`${path}.${fieldDetails.name}`] = flatten[keys[i]];
                } else {
                    output[fieldDetails.name] = flatten[keys[i]];
                }
            }

            return output;
        }

        return {};
    }
}
