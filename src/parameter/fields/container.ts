/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import { groupArrayByKeyPath, merge } from '../../utils';
import { flattenParseAllowedOption } from '../utils';
import type { FieldsParseOptions } from './type';

export class FieldsOptionsContainer<T extends ObjectLiteral = ObjectLiteral> {
    public options : FieldsParseOptions<T>;

    public default : Record<string, string[]>;

    public defaultIsUndefined : boolean;

    public allowed : Record<string, string[]>;

    public allowedIsUndefined : boolean;

    public fields : Record<string, string[]>;

    public keys : string[];

    public reverseMapping : Record<string, string>;

    constructor(input: FieldsParseOptions<T> = {}) {
        this.options = input;

        this.allowed = {};
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultIsUndefined = true;

        this.fields = {};
        this.keys = [];

        this.reverseMapping = {};

        this.buildDefaultDomainFields();
        this.buildAllowedDomainFields();
        this.buildDomainFields();

        this.buildReverseMapping();
    }

    protected buildDefaultDomainFields() {
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

    protected buildAllowedDomainFields() {
        if (typeof this.options.allowed === 'undefined') {
            this.allowed = {};
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = groupArrayByKeyPath(
            flattenParseAllowedOption(this.options.allowed),
        );
        this.allowedIsUndefined = false;
    }

    protected buildDomainFields() {
        this.fields = merge(this.default || {}, this.allowed || {});
        this.keys = Object.keys(this.fields);
    }

    protected buildReverseMapping() {
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
