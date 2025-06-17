/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral, SimpleKeys } from '../../../types';
import {
    isPropertyNameValid,
} from '../../../utils';
import type { FieldsOptions } from './types';
import { BaseSchema } from '../../base';

export class FieldsSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FieldsOptions<T>> {
    public default : string[];

    public defaultIsUndefined : boolean;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    public reverseMapping : Record<string, string>;

    // ---------------------------------------------------------

    constructor(input: FieldsOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = [];
        this.defaultIsUndefined = true;

        this.reverseMapping = {};

        this.setDefault(this.options.default);
        this.setAllowed(this.options.allowed);

        this.initReverseMapping();
    }

    // ---------------------------------------------------------

    /**
     * Check whether all fields are denied.
     */
    get allDenied() {
        return !this.allowedIsUndefined &&
            this.allowed.length === 0 &&
            !this.defaultIsUndefined &&
            this.default.length === 0;
    }

    get mapping() {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    setDefault(input?: SimpleKeys<T>[]) {
        if (typeof input === 'undefined') {
            this.default = [];
            this.defaultIsUndefined = true;
            return;
        }

        this.default = input;
        this.defaultIsUndefined = false;
    }

    setAllowed(input?: SimpleKeys<T>[]) {
        if (typeof input === 'undefined') {
            this.allowed = [];
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = input;
        this.allowedIsUndefined = false;
    }

    // ---------------------------------------------------------

    hasDefaults() {
        return !this.defaultIsUndefined && this.default.length > 0;
    }

    /**
     * Check whether a name exists for a group.
     *
     * @param name
     */
    isValid(
        name: string,
    ): boolean {
        if (!this.allowedIsUndefined) {
            const index = this.allowed.indexOf(name);
            if (index !== -1) {
                return true;
            }
        }

        if (!this.defaultIsUndefined) {
            const index = this.default.indexOf(name);
            if (index !== -1) {
                return true;
            }
        }

        if (
            this.allowedIsUndefined &&
            this.defaultIsUndefined
        ) {
            return isPropertyNameValid(name);
        }

        return false;
    }

    // ---------------------------------------------------------

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
