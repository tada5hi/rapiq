/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { BaseSchemaOptions } from './types';

export class BaseSchema<OPTIONS extends BaseSchemaOptions = BaseSchemaOptions> {
    protected options: OPTIONS;

    // ---------------------------------------------------------

    constructor(options: OPTIONS) {
        this.options = options;
    }

    // ---------------------------------------------------------

    set name(input: string | undefined) {
        this.options.name = input;
    }

    get name() : string | undefined {
        return this.options.name;
    }

    // ---------------------------------------------------------

    set throwOnFailure(input: boolean | undefined) {
        this.options.throwOnFailure = input;
    }

    get throwOnFailure() : boolean | undefined {
        return this.options.throwOnFailure;
    }

    // ---------------------------------------------------------

    set strict(input: boolean | undefined) {
        this.options.strict = input;
    }

    get strict() : boolean | undefined {
        return this.options.strict;
    }

    // ---------------------------------------------------------

    /**
     * Whether `schemaMapping` declares an entry for `input`, including an
     * identity entry (`author: 'author'`) that {@link mapSchema} cannot
     * tell apart from an absent one.
     */
    hasSchemaMapping(input: string) : boolean {
        return !!this.options.schemaMapping &&
            Object.hasOwn(this.options.schemaMapping, input);
    }

    mapSchema(input: string) {
        if (this.options.schemaMapping) {
            return this.options.schemaMapping[input] || input;
        }

        return input;
    }
}
