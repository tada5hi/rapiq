/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */
import { DEFAULT_ID } from '../constants';
import type { Schema } from '../schema';
import { SchemaRegistry, defineSchema } from '../schema';
import type { ObjectLiteral } from '../types';
import { buildKey, parseKey } from '../utils';

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

    protected getBaseSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input?: string | Schema<RECORD>,
    ) : Schema<RECORD> {
        let schema : Schema<RECORD> | undefined;
        if (input) {
            schema = this.registry.getOrFail(input);
        } else {
            schema = defineSchema();
        }

        return schema;
    }

    protected groupByBasePath<T extends Record<string, any>>(input: T) : Record<string, T> {
        const output : Record<string, T> = {};

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            const key = parseKey(keys[i]);

            let prefix : string;
            if (key.path) {
                const dotIndex = key.path.indexOf('.');
                if (dotIndex === -1) {
                    prefix = key.path;
                    key.path = undefined;
                } else {
                    prefix = key.path.substring(0, dotIndex);
                    key.path = key.path.substring(dotIndex + 1);
                }
            } else {
                prefix = DEFAULT_ID;
            }

            if (!output[prefix]) {
                output[prefix] = {} as T;
            }

            const outputKey = buildKey(key);

            output[prefix][outputKey as keyof T] = input[keys[i]] as T[keyof T];
        }

        return output;
    }
}
