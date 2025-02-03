/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import { groupArrayByKeyPath, merge, toFlatObject } from '../../utils';
import { flattenParseAllowedOption } from '../utils';
import type { FieldsParseOptions } from './type';

export class FieldsOptionsContainer<T extends ObjectLiteral = ObjectLiteral> {
    public options : FieldsParseOptions<T>;

    public default : Record<string, string[]>;

    public defaultIsUndefined : boolean;

    public allowed : Record<string, string[]>;

    public allowedIsUndefined : boolean;

    public items : Record<string, string[]>;

    public keys : string[];

    public reverseMapping : Record<string, string>;

    constructor(input: FieldsParseOptions<T> = {}) {
        this.options = input;

        this.allowed = {};
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultIsUndefined = true;

        this.items = {};
        this.keys = [];

        this.reverseMapping = {};

        this.initDefault();
        this.initAllowed();
        this.initItems();

        this.initReverseMapping();
    }

    protected initDefault() {
        if (typeof this.options.default === 'undefined') {
            this.default = {};
            this.defaultIsUndefined = true;
            return;
        }

        this.default = groupArrayByKeyPath(
            flattenParseAllowedOption(this.options.default),
        );
        this.defaultIsUndefined = false;
    }

    protected initAllowed() {
        if (typeof this.options.allowed === 'undefined') {
            if (typeof this.options.default !== 'undefined') {
                const items = toFlatObject(this.options.default, {
                    validator(input) {
                        if (!Array.isArray(input)) {
                            return false;
                        }

                        return !input.some((el) => typeof el !== 'string');
                    },
                });

                if (items.length > 0) {
                    this.allowed = items;
                    this.allowedIsUndefined = false;
                    return;
                }
            }

            this.allowed = {};
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = groupArrayByKeyPath(
            flattenParseAllowedOption(this.options.allowed),
        );
        this.allowedIsUndefined = false;
    }

    protected initItems() {
        this.items = merge(this.default || {}, this.allowed || {});
        this.keys = Object.keys(this.items);
    }

    protected initReverseMapping() {
        if (typeof this.options.mapping === 'undefined') {
            return;
        }

        this.reverseMapping = this.buildReverseRecord(this.options.mapping);
    }

    private buildReverseRecord(
        record: Record<string, string>,
    ) : Record<string, string> {
        const keys = Object.keys(record);
        const output : Record<string, string> = {};

        for (let i = 0; i < keys.length; i++) {
            output[record[keys[i]]] = keys[i];
        }

        return output;
    }
}
