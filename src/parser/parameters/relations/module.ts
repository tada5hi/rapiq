/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { applyMapping, hasOwnProperty, isPathCoveredByParseAllowedOption } from '../../../utils';
import { RelationsParseError } from './error';
import { BaseParser } from '../../base';
import {
    RelationsSchema, Schema, defineRelationsSchema,
} from '../../../schema';
import type { RelationsParseOutput } from './types';

// --------------------------------------------------

type RelationsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    schema?: string | Schema<RECORD> | RelationsSchema<RECORD>
};

export class RelationsParser extends BaseParser<
RelationsParseOptions,
RelationsParseOutput
> {
    parse<
    RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: RelationsParseOptions<RECORD> = {},
    ) : RelationsParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            Array.isArray(schema.allowed) &&
            schema.allowed.length === 0
        ) {
            return [];
        }

        let items: string[] = [];

        if (typeof input === 'string') {
            items = input.split(',');
        } else if (Array.isArray(input)) {
            for (let i = 0; i < input.length; i++) {
                if (typeof input[i] === 'string') {
                    items.push(input[i]);
                } else {
                    throw RelationsParseError.inputInvalid();
                }
            }
        } else if (schema.throwOnFailure) {
            throw RelationsParseError.inputInvalid();
        }

        if (items.length === 0) {
            return [];
        }

        const mappingKeys = Object.keys(schema.mapping);
        if (mappingKeys.length > 0) {
            for (let i = 0; i < items.length; i++) {
                items[i] = applyMapping(items[i], schema.mapping);
            }
        }

        for (let j = items.length - 1; j >= 0; j--) {
            let isValid : boolean;
            if (schema.allowed) {
                isValid = isPathCoveredByParseAllowedOption(schema.allowed as string[], items[j]);
            } else {
                isValid = this.isValidPath(items[j]);
            }

            if (!isValid) {
                if (schema.throwOnFailure) {
                    throw RelationsParseError.keyInvalid(items[j]);
                }

                items.splice(j, 1);
            }
        }

        if (schema.includeParents) {
            if (Array.isArray(schema.includeParents)) {
                const parentIncludes = items.filter(
                    (item) => item.includes('.') &&
                        (schema.includeParents as string[]).filter((parent) => item.startsWith(parent)).length > 0,
                );
                items.unshift(...this.includeParents(parentIncludes));
            } else {
                items = this.includeParents(items);
            }
        }

        items = Array.from(new Set(items));

        return items
            .map((key) => {
                const parts = key.split('.');

                let value : string;
                if (
                    schema.pathMapping &&
                    hasOwnProperty(schema.pathMapping, key)
                ) {
                    value = schema.pathMapping[key];
                } else {
                    value = parts.pop() as string;
                }

                return {
                    key,
                    value,
                };
            });
    }

    // --------------------------------------------------

    protected includeParents(
        data: string[],
    ) : string[] {
        const output : string[] = [
            ...data,
        ];

        for (let i = 0; i < data.length; i++) {
            const parts: string[] = data[i].split('.');

            while (parts.length > 0) {
                parts.pop();

                if (parts.length > 0) {
                    const value = parts.join('.');
                    if (output.indexOf(value) === -1) {
                        output.push(value);
                    }
                }
            }
        }

        return output.reverse();
    }

    protected isValidPath(input: string) : boolean {
        return /^[a-zA-Z0-9_-]+([.]*[a-zA-Z0-9_-])*$/gu.test(input);
    }

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | RelationsSchema<RECORD>) : RelationsSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.relations;
        }

        if (input instanceof RelationsSchema) {
            return input;
        }

        return defineRelationsSchema();
    }
}
