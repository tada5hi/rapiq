/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    BaseFieldsParser,
    DEFAULT_ID,
    Field,
    FieldOperator,
    Fields,
    FieldsParseError,
    applyMapping,
    groupArrayByKeyPath, 
    isObject, 
    isPathAllowed,
} from '@rapiq/core';
import type {
    IFields, 
    ObjectLiteral,
    Relations,
} from '@rapiq/core';
import type { SimpleFieldsParseOptions } from './types';

export class SimpleFieldsParser extends BaseFieldsParser<SimpleFieldsParseOptions> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: SimpleFieldsParseOptions<RECORD> = {},
    ) : IFields {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array, nothing is allowed
        if (schema.allDenied) {
            return new Fields();
        }

        const normalized = this.normalize(input, schema.throwOnFailure);

        if (schema.name) {
            const named = normalized[schema.name];
            if (named) {
                normalized[DEFAULT_ID] = named;
                delete normalized[schema.name];
            }
        }

        const data = normalized[DEFAULT_ID] || [];
        delete normalized[DEFAULT_ID];

        const fields = new Fields();

        if (data.length > 0) {
            for (let value of data) {
                let operator: FieldOperator | undefined;

                const character = value.substring(0, 1);
                if (
                    character === FieldOperator.INCLUDE ||
                    character === FieldOperator.EXCLUDE
                ) {
                    operator = character;

                    value = value.substring(1);
                }

                value = applyMapping(value, schema.mapping);

                if (!schema.isValid(value)) {
                    if (schema.throwOnFailure) {
                        throw FieldsParseError.keyNotPermitted(value);
                    }

                    continue;
                }

                fields.value.push(new Field(value, operator));
            }
        }

        const output = fields.execute({
            default: schema.default,
            allowed: schema.allowed,
        });

        const keys = Object.keys(normalized);

        if (options.relations) {
            for (const relation of options.relations.value) {
                const index = keys.indexOf(relation.name);
                if (index === -1) {
                    keys.push(relation.name);
                    normalized[relation.name] = [];
                }
            }
        }

        const grouped : Record<string, Record<string, any>> = {};
        for (const key of keys) {
            let group : string;
            let relation : string;

            const index = key.indexOf('.');
            if (index === -1) {
                group = key;
                relation = DEFAULT_ID;
            } else {
                group = key.substring(0, index);
                relation = key.substring(index + 1);
            }

            const groupRecord = grouped[group] ?? {};
            grouped[group] = groupRecord;
            groupRecord[relation] = normalized[key];
        }

        const groupedKeys = Object.keys(grouped);

        for (const key of groupedKeys) {
            if (!isPathAllowed(key, options.relations)) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(key);
                }

                continue;
            }

            // todo: also pass options.schema
            const relationSchema = this.registry.resolve(schema.name, key);
            if (!relationSchema) {
                if (schema.throwOnFailure) {
                    throw FieldsParseError.keyPathInvalid(key);
                }
            }

            let childRelations : Relations | undefined;
            if (typeof options.relations !== 'undefined') {
                childRelations = options.relations.extract(key);
            }

            const relationOutput = this.parse(
                grouped[key],
                {
                    schema: relationSchema,
                    relations: childRelations,
                },
            );

            output.value.push(...relationOutput.value.map(
                (element) => new Field(`${key}.${element.name}`, element.operator),
            ));
        }

        return output;
    }

    protected normalize(
        input: unknown,
        throwOnFailure?: boolean,
    ) : Record<string, string[]> {
        if (this.isTupleInput(input)) {
            return this.normalize({
                [DEFAULT_ID]: input[0],
                ...input[1],
            });
        }

        if (
            typeof input === 'string' ||
            Array.isArray(input)
        ) {
            let temp : unknown[];
            if (typeof input === 'string') {
                temp = input.split(',');
            } else {
                temp = input;
            }

            const parts : string[] = [];
            for (const element of temp) {
                if (typeof element !== 'string') {
                    if (throwOnFailure) {
                        throw FieldsParseError.inputInvalid();
                    }

                    continue;
                }

                parts.push(element as string);
            }

            if (parts.length > 0) {
                return groupArrayByKeyPath(parts);
            }

            return {};
        }

        if (isObject(input)) {
            const output : Record<string, string[]> = {};

            const keys = Object.keys(input);
            for (const key of keys) {
                const temp = this.normalize(input[key], throwOnFailure);
                for (const [tempKey, value] of Object.entries(temp)) {
                    let nextKey : string;
                    if (tempKey === DEFAULT_ID) {
                        nextKey = key;
                    } else {
                        nextKey = `${key}.${tempKey}`;
                    }
                    output[nextKey] = value;
                }
            }

            return output;
        }

        if (input === undefined || input === null || input === '') {
            return {};
        }

        if (throwOnFailure) {
            throw FieldsParseError.inputInvalid();
        }

        return {};
    }

    protected isTupleInput(input: unknown) : input is [string[], Record<string, any>] {
        if (!Array.isArray(input) || input.length !== 2) {
            return false;
        }

        return Array.isArray(input[0]) && isObject(input[1]);
    }
}
