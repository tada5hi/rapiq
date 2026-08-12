/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../errors';
import { Schema } from '../module';
import type { RegisteredSchema } from './types';
import type { ObjectLiteral } from '../../types';

export class SchemaRegistry<CONTEXT = any> {
    protected entities : Map<string, Schema<any, CONTEXT>>;

    // ----------------------------------------------------

    constructor() {
        this.entities = new Map<string, Schema<any, CONTEXT>>();
    }

    // ----------------------------------------------------

    /**
     * Register a schema under the name it declares. Throws
     * {@link SchemaError.nameUndefined} when it declares none, so every
     * registered schema is guaranteed to carry one.
     */
    add<T extends ObjectLiteral>(schema: Schema<T, CONTEXT>) : void;

    /**
     * Register a schema under `name`, which the schema adopts (and
     * restamps onto its sub-schemas), so the registry key and the
     * schema's own name cannot disagree. Takes precedence over a name
     * the schema declares itself.
     */
    add<T extends ObjectLiteral>(name: string, schema: Schema<T, CONTEXT>) : void;

    add<T extends ObjectLiteral>(
        ...input: [Schema<T, CONTEXT>] | [string, Schema<T, CONTEXT>]
    ) : void {
        if (input.length === 2) {
            const [name, schema] = input;

            schema.name = name;
            this.entities.set(name, schema);

            return;
        }

        const [schema] = input;
        if (typeof schema.name === 'undefined') {
            throw SchemaError.nameUndefined();
        }

        this.entities.set(schema.name, schema);
    }

    drop(name: string) {
        this.entities.delete(name);
    }

    // ----------------------------------------------------

    get<
        T extends ObjectLiteral = ObjectLiteral,
    >(name: Schema<T, CONTEXT> | string): Schema<T, CONTEXT> | undefined {
        if (typeof name === 'string') {
            return this.entities.get(name);
        }

        return name;
    }

    getOrFail<
        T extends ObjectLiteral = ObjectLiteral,
    >(name: string | Schema<T, CONTEXT>): Schema<T, CONTEXT> {
        const schema = this.get(name);
        if (typeof schema === 'undefined') {
            throw SchemaError.notResolvable(name as string);
        }

        return schema;
    }

    /**
     * Every registered schema, in registration order. The array is a fresh
     * snapshot the caller owns: sorting or splicing it changes nothing here,
     * and a later {@link add} or {@link drop} leaves an array already held
     * untouched. Its elements are the live instances {@link get} returns, so
     * one can be handed straight back to a parser, a codec or an adapter,
     * and each carries the name it was registered under.
     */
    getAll() : RegisteredSchema<any, CONTEXT>[] {
        // registration guarantees a name, which the element type states
        // and the compiler cannot see.
        return Array.from(this.entities.values()) as RegisteredSchema<any, CONTEXT>[];
    }

    // ----------------------------------------------------

    resolve(...input: (undefined | Schema | string)[]) : Schema | undefined {
        const normalized : (Schema | string)[] = [];
        for (const current of input) {
            if (typeof current === 'string') {
                normalized.push(...current.split('.'));
            } else if (current instanceof Schema) {
                normalized.push(current);
            }
        }

        let current : Schema | undefined;
        while (normalized.length > 0) {
            const next = normalized.shift();
            if (next) {
                if (next instanceof Schema) {
                    current = next;
                } else if (current) {
                    current = this.get(current.mapSchema(next));
                } else {
                    current = this.get(next);
                }
            }
        }

        return current;
    }
}
