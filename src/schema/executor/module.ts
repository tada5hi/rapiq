/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ParseInput, ParseOutput } from '../../parse';
import type { SchemaRegistry } from '../registry';

export class SchemaExecutor {
    protected registry: SchemaRegistry;

    // ----------------------------------------------------

    constructor(registry: SchemaRegistry) {
        this.registry = registry;
    }

    // ----------------------------------------------------

    parseQuery(name: string, input: ParseInput) : ParseOutput {
        const schema = this.registry.get(name);
        if (!schema) {
            throw new Error(`The schema ${name} does not exist`);
        }

        return schema.parseQuery(input, {
            registry: this.registry,
        });
    }

    buildQuery(name: string, input: unknown) : string {
        const schema = this.registry.get(name);
        if (!schema) {
            throw new Error(`The schema ${name} does not exist`);
        }

        return schema.buildQuery(input);
    }
}
