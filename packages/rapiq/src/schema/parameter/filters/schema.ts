/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Filter } from '../../../parameter';
import type { MaybeAsync, ObjectLiteral, SimpleKeys } from '../../../types';
import {
    toFlatObject,
} from '../../../utils';
import type {
    FiltersOptionDefault,
    FiltersOptions,
} from './types';
import { BaseSchema } from '../../base';

export class FiltersSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FiltersOptions<T>> {
    public default : Record<string, any>;

    public defaultIsUndefined : boolean;

    public defaultKeys : string[];

    public allowed : string[];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: FiltersOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultIsUndefined = true;
        this.defaultKeys = [];

        this.setDefault(this.options.default);
        this.setAllowed(this.options.allowed);
    }

    // ---------------------------------------------------------

    get mapping() {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    hasDefaults() {
        return !this.defaultIsUndefined && this.defaultKeys.length > 0;
    }

    validate(input: Filter) : MaybeAsync<Filter | undefined> {
        if (typeof this.options.validate === 'undefined') {
            return input;
        }

        return this.options.validate(input);
    }

    // ---------------------------------------------------------

    setDefault(input?: FiltersOptionDefault<T>) {
        if (!input) {
            this.default = {};
            this.defaultIsUndefined = true;
            this.defaultKeys = [];
            return;
        }

        this.default = toFlatObject(input);
        this.defaultIsUndefined = false;
        this.defaultKeys = Object.keys(this.default);
    }

    setAllowed(input?: SimpleKeys<T>[]) {
        if (typeof input === 'undefined') {
            if (!this.defaultIsUndefined) {
                this.allowed = [...this.defaultKeys];
                this.allowedIsUndefined = false;
                return;
            }

            this.allowed = [];
            this.allowedIsUndefined = true;
            return;
        }

        this.allowed = input;
        this.allowedIsUndefined = false;
    }

    // ---------------------------------------------------------
}
