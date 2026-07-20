/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../errors';
import { Schema } from '../module';
import type { ObjectLiteral } from '../../types';

export class SchemaRegistry<CONTEXT = any> {
    protected entities : Map<string, Schema<any, CONTEXT>>;

    // ----------------------------------------------------

    constructor() {
        this.entities = new Map<string, Schema<any, CONTEXT>>();
    }

    // ----------------------------------------------------

    add<T extends ObjectLiteral>(schema: Schema<T, CONTEXT>) {
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
