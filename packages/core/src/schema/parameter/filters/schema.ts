/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilter } from '../../../parameter';
import type { ObjectLiteral, SimpleKeys } from '../../../types';
import type {
    FiltersOptions,
} from './types';
import { BaseSchema } from '../../base';
import { SchemaError } from '../../../errors';

function isPromiseLike(input: unknown) : input is PromiseLike<unknown> {
    return (
        input !== null &&
        (typeof input === 'object' || typeof input === 'function') &&
        'then' in input &&
        typeof input.then === 'function'
    );
}

export class FiltersSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<FiltersOptions<T>> {
    public default : ICondition | undefined;

    public defaultIsUndefined : boolean;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    public caseSensitive : string[];

    // ---------------------------------------------------------

    constructor(input: FiltersOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = undefined;
        this.defaultIsUndefined = true;

        this.caseSensitive = [];

        this.setDefault(this.options.default);
        this.setAllowed(this.options.allowed);
        this.setCaseSensitive(this.options.caseSensitive);
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

    validate(input: IFilter) : IFilter | undefined | void {
        if (typeof this.options.validate === 'undefined') {
            return input;
        }

        const output : unknown = this.options.validate(input);
        if (isPromiseLike(output)) {
            throw SchemaError.validatorAsyncUnsupported();
        }

        return output as IFilter | undefined | void;
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

    setCaseSensitive(input?: SimpleKeys<T>[]) {
        this.caseSensitive = input || [];
    }

    // ---------------------------------------------------------
}
