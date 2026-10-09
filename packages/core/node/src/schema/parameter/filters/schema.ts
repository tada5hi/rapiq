/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFilter } from '../../../parameter';
import type { MaybeAsync, ObjectLiteral, SimpleKeys } from '../../../types';
import type { IndexedMode } from '../../indexes';
import type {
    FiltersOptions,
    FiltersSchemaDescription,
} from './types';
import { BaseSchema } from '../../base';

export class FiltersSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseSchema<FiltersOptions<T, CONTEXT>> {
    public default : ICondition | undefined;

    public defaultIsUndefined : boolean;

    public allowed : string[];

    public allowedIsUndefined : boolean;

    public caseSensitive : string[];

    public caseSensitiveIsUndefined : boolean;

    public indexes : string[][];

    public indexesIsUndefined : boolean;

    public indexed : IndexedMode | false;

    // ---------------------------------------------------------

    constructor(input: FiltersOptions<T> = {}) {
        super(input);

        this.allowed = [];
        this.allowedIsUndefined = true;

        this.default = undefined;
        this.defaultIsUndefined = true;

        this.caseSensitive = [];
        this.caseSensitiveIsUndefined = true;

        this.indexes = [];
        this.indexesIsUndefined = true;
        this.indexed = this.options.indexed === true ?
            'anchor' :
            (this.options.indexed || false);

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

    /**
     * Serialize the declared constraints. Arrays are cloned, so a
     * consumer mutating the description never touches the schema.
     */
    describe() : FiltersSchemaDescription {
        return {
            allowed: this.allowedIsUndefined ? null : [...this.allowed],
            caseSensitive: this.caseSensitiveIsUndefined ? null : [...this.caseSensitive],
            indexed: this.indexed,
        };
    }

    // ---------------------------------------------------------

    hasValidator() {
        return typeof this.options.validate !== 'undefined';
    }

    validate(input: IFilter, context: CONTEXT) : MaybeAsync<ICondition | undefined> {
        if (typeof this.options.validate === 'undefined') {
            return input;
        }

        return this.options.validate(input, context);
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
        if (typeof input === 'undefined') {
            this.caseSensitive = [];
            this.caseSensitiveIsUndefined = true;
            return;
        }

        this.caseSensitive = input;
        this.caseSensitiveIsUndefined = false;
    }

    setIndexes(input?: string[][]) {
        if (typeof input === 'undefined') {
            this.indexes = [];
            this.indexesIsUndefined = true;
            return;
        }

        this.indexes = input;
        this.indexesIsUndefined = false;
    }

    // ---------------------------------------------------------
}
