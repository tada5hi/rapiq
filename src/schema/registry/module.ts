/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Schema } from '../module';

export class SchemaRegistry {
    protected entities : Map<string, Schema>;

    // ----------------------------------------------------

    constructor() {
        this.entities = new Map<string, Schema>();
    }

    // ----------------------------------------------------

    register(name: string, schema: Schema) {
        this.entities.set(name, schema);
    }

    unregister(name: string) {
        this.entities.delete(name);
    }

    // ----------------------------------------------------

    get(name: string): Schema | undefined {
        return this.entities.get(name);
    }
}
