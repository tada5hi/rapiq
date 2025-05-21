/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { applyMapping, hasOwnProperty, isPathCoveredByParseAllowedOption } from '../../../utils';
import { RelationsParseError } from './error';

import { includeParents, isValidRelationPath } from '../../../schema/parameter/relations/utils';
import { BaseParser } from '../../module';
import type { Schema, SchemaOptions } from '../../../schema';
import type { RelationsParseOutput } from './types';

// --------------------------------------------------

type RelationsParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema | SchemaOptions
};

export class RelationsParser extends BaseParser<
RelationsParseOptions,
RelationsParseOutput
> {
    parse(
        input: unknown,
        options: RelationsParseOptions = {},
    ) : RelationsParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            Array.isArray(schema.relations.allowed) &&
            schema.relations.allowed.length === 0
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
        } else if (schema.relations.throwOnFailure) {
            throw RelationsParseError.inputInvalid();
        }

        if (items.length === 0) {
            return [];
        }

        const mappingKeys = Object.keys(schema.relations.mapping);
        if (mappingKeys.length > 0) {
            for (let i = 0; i < items.length; i++) {
                items[i] = applyMapping(items[i], schema.relations.mapping);
            }
        }

        for (let j = items.length - 1; j >= 0; j--) {
            let isValid : boolean;
            if (schema.relations.allowed) {
                isValid = isPathCoveredByParseAllowedOption(schema.relations.allowed as string[], items[j]);
            } else {
                isValid = isValidRelationPath(items[j]);
            }

            if (!isValid) {
                if (schema.relations.throwOnFailure) {
                    throw RelationsParseError.keyInvalid(items[j]);
                }

                items.splice(j, 1);
            }
        }

        if (schema.relations.includeParents) {
            if (Array.isArray(schema.relations.includeParents)) {
                const parentIncludes = items.filter(
                    (item) => item.includes('.') &&
                        (schema.relations.includeParents as string[]).filter((parent) => item.startsWith(parent)).length > 0,
                );
                items.unshift(...includeParents(parentIncludes));
            } else {
                items = includeParents(items);
            }
        }

        items = Array.from(new Set(items));

        return items
            .map((key) => {
                const parts = key.split('.');

                let value : string;
                if (
                    schema.relations.pathMapping &&
                    hasOwnProperty(schema.relations.pathMapping, key)
                ) {
                    value = schema.relations.pathMapping[key];
                } else {
                    value = parts.pop() as string;
                }

                return {
                    key,
                    value,
                };
            });
    }
}
