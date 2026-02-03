/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilter } from '../../../parameter';
import type { MaybeAsync, ObjectLiteral, SimpleKeys } from '../../../types';
import type {
    FiltersOptions,
} from './types';
import { BaseSchema } from '../../base';

export class FiltersSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FiltersOptions<T>> {
    public default : ICondition | undefined;

    public defaultIsUndefined : boolean;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: FiltersOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = undefined;
        this.defaultIsUndefined = true;

        this.setDefault(this.options.default);
        this.setAllowed(this.options.allowed);
    }

    // ---------------------------------------------------------

    get mapping() {
        return this.options.mapping;
    }

    // ---------------------------------------------------------

    hasDefaults() {
        return !this.defaultIsUndefined;
    }

    // ---------------------------------------------------------

    validate(input: IFilter) : MaybeAsync<IFilter | undefined | void> {
        if (typeof this.options.validate === 'undefined') {
            return input;
        }

        return this.options.validate(input);
    }

    // ---------------------------------------------------------

    setDefault(input?: ICondition) {
        this.default = input;
        this.defaultIsUndefined = !input;
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
}
