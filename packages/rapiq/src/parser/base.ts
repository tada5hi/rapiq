/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { setPathValue } from 'pathtrace';
import { DEFAULT_ID } from '../constants';
import type { Schema } from '../schema';
import { SchemaRegistry, defineSchema } from '../schema';
import type { ObjectLiteral } from '../types';
import { isObject, parseKey, stringifyKey } from '../utils';
import type { IParser } from './types';

type TempType = {
    attributes: Record<string, any>,
    relations: Record<string, TempType>
};

export abstract class BaseParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
    OUTPUT = any,
> implements IParser<unknown, OUTPUT, OPTIONS> {
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

    abstract parse(input: unknown, options?: OPTIONS): OUTPUT;

    async parseAsync(input: unknown, options?: OPTIONS): Promise<OUTPUT> {
        return this.parse(input, options);
    }

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

    protected expandObject(
        input: Record<string, any>,
        aggregated: Record<string, any> = {},
    ) {
        const output : Record<string, any> = aggregated || {};

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            if (isObject(input[keys[i]])) {
                setPathValue(output, keys[i], this.expandObject(input[keys[i]], output));
            } else {
                setPathValue(output, keys[i], input[keys[i]]);
            }
        }

        return output;
    }

    protected groupObject(input: Record<string, any>) {
        const output : TempType = {
            attributes: {},
            relations: {},
        };

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            if (isObject(input[keys[i]])) {
                output.relations[keys[i]] = this.groupObject(input[keys[i]]);
            } else {
                output.attributes[keys[i]] = input[keys[i]];
            }
        }

        return output;
    }

    protected groupObjectByBasePath<T extends Record<string, any>>(
        input: T,
    ) : Record<string, T> {
        const output : Record<string, T> = {};

        const keys = Object.keys(input);

        this.groupByFieldPathWithFn(
            keys,
            (prefix, key, index) => {
                if (!output[prefix]) {
                    output[prefix] = {} as T;
                }

                output[prefix][key as keyof T] = input[keys[index]] as T[keyof T];
            },
        );

        return output;
    }

    protected groupArrayByBasePath(
        input: string[],
    ) : Record<string, string[]> {
        const output : Record<string, string[]> = {};

        this.groupByFieldPathWithFn(
            input,
            (prefix, key) => {
                if (!output[prefix]) {
                    output[prefix] = [];
                }

                output[prefix].push(key);
            },
        );

        return output;
    }

    protected groupByFieldPathWithFn(
        items: string[],
        cb: (
            prefix: string,
            key: string,
            index: number
        ) => void,
    ) : void {
        for (let i = 0; i < items.length; i++) {
            const key = parseKey(items[i]);

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

            cb(prefix, stringifyKey(key), i);
        }
    }
}
