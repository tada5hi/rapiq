/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Schema } from '../module';
import type { ObjectLiteral } from '../../types';

export class SchemaRegistry {
    protected entities : Map<string, Schema<any>>;

    // ----------------------------------------------------

    constructor() {
        this.entities = new Map<string, Schema<any>>();
    }

    // ----------------------------------------------------

    add<T extends ObjectLiteral>(schema: Schema<T>) {
        if (typeof schema.name === 'undefined') {
            throw new Error('The schema name is not defined.');
        }

        this.entities.set(schema.name, schema);
    }

    drop(name: string) {
        this.entities.delete(name);
    }

    // ----------------------------------------------------

    get<
        T extends ObjectLiteral = ObjectLiteral,
    >(name: Schema<T> | string): Schema<T> | undefined {
        if (typeof name === 'string') {
            return this.entities.get(name);
        }

        return name;
    }

    getOrFail<
        T extends ObjectLiteral = ObjectLiteral,
    >(name: string | Schema<T>): Schema<T> {
        const schema = this.get(name);
        if (typeof schema === 'undefined') {
            throw new Error(`Cannot find schema with name "${name}".`);
        }

        return schema;
    }

    // ----------------------------------------------------

    resolve(...input: (undefined | Schema | string)[]) : Schema | undefined {
        const normalized : (Schema | string)[] = [];
        for (let i = 0; i < input.length; i++) {
            const current = input[i];
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
