/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */
import type { Schema } from '../schema';
import { SchemaRegistry, defineSchema } from '../schema';
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

    protected resolveBaseSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD>) : Schema<RECORD> {
        let schema : Schema<RECORD> | undefined;
        if (input) {
            if (typeof input === 'string') {
                const parts = input.split('.');
                if (parts.length === 0) {
                    return this.registry.getOrFail(input) as Schema<RECORD>;
                }

                while (parts.length > 0) {
                    const part = parts.shift() as string;

                    schema = this.registry.getOrFail(part) as Schema<RECORD>;
                    if (parts.length > 0) {
                        parts[0] = schema.mapSchema(parts[0]);
                    }
                }

                return schema as Schema<RECORD>;
            }

            schema = input;
        } else {
            schema = defineSchema();
        }

        return schema;
    }
}
