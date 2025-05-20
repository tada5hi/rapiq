/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */
import { type Schema, SchemaRegistry, defineSchema } from '../schema';
import type { ObjectLiteral } from '../types';

export abstract class BaseParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
    OUTPUT = any,
> {
    protected registry: SchemaRegistry;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        let registry: SchemaRegistry;
        if (input instanceof SchemaRegistry) {
            registry = input;
        } else {
            registry = new SchemaRegistry();
        }

        this.registry = registry;
    }

    // --------------------------------------------------

    abstract parse(input: unknown, options: OPTIONS) : OUTPUT;

    // --------------------------------------------------

    resolveSchema(input?: string | Schema) {
        let schema : Schema;
        if (input) {
            if (typeof input === 'string') {
                schema = this.registry.getOrFail(input);
            } else {
                schema = input;
            }
        } else {
            schema = defineSchema();
        }

        return schema;
    }
}
