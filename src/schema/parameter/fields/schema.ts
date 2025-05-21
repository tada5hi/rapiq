/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import type { OptionAllowed } from '../../../utils';
import {
    flattenParseAllowedOption,
    groupArrayByKeyPath,
    hasOwnProperty, isPropertyNameValid,
} from '../../../utils';
import type { FieldsOptions } from './types';
import { BaseSchema } from '../../base';

export class FieldsSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FieldsOptions<T>> {
    public default : Record<string, string[]>;

    public defaultKeys : string[];

    public defaultIsUndefined : boolean;

    public allowed : Record<string, string[]>;

    public allowedKeys : string[];

    public allowedIsUndefined : boolean;

    public reverseMapping : Record<string, string>;

    // ---------------------------------------------------------

    constructor(input: FieldsOptions<T> = {}) {
        super(input);

        this.allowed = {};
        this.allowedKeys = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultKeys = [];
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
            this.allowedKeys.length === 0 &&
            !this.defaultIsUndefined &&
            this.defaultKeys.length === 0;
    }

    get mapping() {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    setDefault(input?: OptionAllowed<T>) {
        if (typeof input === 'undefined') {
            this.default = {};
            this.defaultKeys = [];
            this.defaultIsUndefined = true;
            return;
        }

        this.default = groupArrayByKeyPath(
            flattenParseAllowedOption(input),
            this.defaultPath,
        );
        this.defaultKeys = Object.keys(this.default);
        this.defaultIsUndefined = false;
    }

    setAllowed(input?: OptionAllowed<T>) {
        if (typeof input === 'undefined') {
            this.allowed = {};
            this.allowedKeys = [];
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = groupArrayByKeyPath(
            flattenParseAllowedOption(input),
            this.defaultPath,
        );
        this.allowedKeys = Object.keys(this.allowed);
        this.allowedIsUndefined = false;
    }

    // ---------------------------------------------------------

    hasDefaults() {
        return !this.defaultIsUndefined && this.defaultKeys.length > 0;
    }

    /**
     * Check whether a name exists for a group.
     *
     * @param name
     * @param group
     */
    isValid(
        name: string,
        group: string,
    ): boolean {
        if (
            !this.allowedIsUndefined &&
            hasOwnProperty(this.allowed, group)
        ) {
            const index = this.allowed[group].indexOf(name);
            if (index !== -1) {
                return true;
            }
        }

        if (
            !this.defaultIsUndefined &&
            hasOwnProperty(this.default, group)
        ) {
            const index = this.default[group].indexOf(name);
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
