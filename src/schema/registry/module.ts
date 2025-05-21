/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Schema } from '../module';
import type { ObjectLiteral } from '../../types';

export class SchemaRegistry {
    protected entities : Map<string, Schema<any>>;

    // ----------------------------------------------------

    constructor() {
        this.entities = new Map<string, Schema<any>>();
    }

    // ----------------------------------------------------

    add<T extends ObjectLiteral>(name: string, schema: Schema<T>) {
        this.entities.set(name, schema);
    }

    drop(name: string) {
        this.entities.delete(name);
    }

    // ----------------------------------------------------

    get(name: string): Schema | undefined {
        return this.entities.get(name);
    }

    getOrFail(name: string): Schema {
        const schema = this.get(name);
        if (typeof schema === 'undefined') {
            throw new Error(`Cannot find schema with name "${name}".`);
        }

        return schema;
    }

    // ----------------------------------------------------

    getFirst() : Schema | undefined {
        const key = this.entities.keys().next().value;
        if (!key) {
            return undefined;
        }

        return this.entities.get(key);
    }

    getFirstOrFail() : Schema {
        const schema = this.getFirst();
        if (typeof schema === 'undefined') {
            throw new Error('The registry is empty.');
        }

        return schema;
    }

    // ----------------------------------------------------

    get size(): number {
        return this.entities.size;
    }
}
