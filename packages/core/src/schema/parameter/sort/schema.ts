/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import type {
    SortOptions,
    SortSchemaDescription,
} from './types';
import { BaseKeyValidatableSchema } from '../../key-validatable';

export class SortSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseKeyValidatableSchema<SortOptions<T, CONTEXT>> {
    public default : Record<string, any>;

    public defaultKeys : string[];

    public defaultIsUndefined : boolean;

    public allowed : string[] | string[][];

    public allowedIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(input: SortOptions<T, CONTEXT> = {}) {
        super(input, Parameter.SORT);

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

    /**
     * Serialize the declared constraints. Arrays and records are
     * cloned, so a consumer mutating the description never touches
     * the schema. An allow-list derived from `default` keys (see
     * {@link SortSchema.buildAllowed}) serializes like a declared one.
     */
    describe() : SortSchemaDescription {
        return {
            allowed: this.allowedIsUndefined ?
                null :
                this.allowed.map(
                    (el) => (Array.isArray(el) ? [...el] : el),
                ) as string[] | string[][],
            default: this.defaultIsUndefined ? null : { ...this.default },
        };
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
