/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { MaybeAsync, ObjectLiteral } from '../../../types';
import type {
    SortOptions,
} from './types';
import { BaseSchema } from '../../base';

export class SortSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseSchema<SortOptions<T, CONTEXT>> {
    public default : Record<string, any>;

    public defaultKeys : string[];

    public defaultIsUndefined : boolean;

    public allowed : string[] | string[][];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: SortOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = {};
        this.defaultKeys = [];
        this.defaultIsUndefined = true;

        this.buildDefault();
        this.buildAllowed();
    }

    // ---------------------------------------------------------

    get mapping() : Record<string, string> | undefined {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    hasValidator() {
        return typeof this.options.validate !== 'undefined';
    }

    validate(name: string, context: CONTEXT) : MaybeAsync<boolean | undefined> {
        if (typeof this.options.validate === 'undefined') {
            return true;
        }

        return this.options.validate(name, context);
    }

    // ---------------------------------------------------------

    protected buildDefault() {
        if (!this.options.default) {
            this.default = {};
            this.defaultKeys = [];
            this.defaultIsUndefined = true;
            return;
        }

        this.default = this.options.default;
        this.defaultKeys = Object.keys(this.default);
        this.defaultIsUndefined = false;
    }

    protected buildAllowed() {
        if (typeof this.options.allowed === 'undefined') {
            if (typeof this.options.default !== 'undefined') {
                const flatten = this.options.default;
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

        this.allowed = this.options.allowed;
        this.allowedIsUndefined = false;
    }
}
