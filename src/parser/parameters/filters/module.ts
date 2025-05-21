/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { NestedKeys, ObjectLiteral } from '../../../types';
import type { KeyDetails } from '../../../utils';
import {
    applyMapping,
    buildKeyWithPath,
    isObject,
    isPathAllowedByRelations,
    isPathCoveredByParseAllowedOption,
    isPropertyNameValid,
    parseKey,
} from '../../../utils';
import { FiltersParseError } from './error';
import { BaseParser } from '../../module';
import {
    FiltersSchema, Schema, defineFiltersSchema,
} from '../../../schema';
import type { RelationsParseOutput } from '../relations';
import type { FiltersParseOutput, FiltersParseOutputElement } from './types';

type FiltersParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    relations?: RelationsParseOutput,
    schema?: string | Schema<RECORD> | FiltersSchema<RECORD>
};

export class FiltersParser extends BaseParser<
FiltersParseOptions,
FiltersParseOutput
> {
    parse<RECORD extends ObjectLiteral = ObjectLiteral>(
        data: unknown,
        options: FiltersParseOptions<RECORD> = {},
    ) : FiltersParseOutput {
        const schema = this.resolveSchema(options.schema);

        // If it is an empty array nothing is allowed
        if (
            !schema.allowedIsUndefined &&
            schema.allowed.length === 0
        ) {
            return schema.defaultOutput;
        }

        /* istanbul ignore next */
        if (!isObject(data)) {
            if (schema.throwOnFailure) {
                throw FiltersParseError.inputInvalid();
            }

            return schema.defaultOutput;
        }

        const { length } = Object.keys(data);
        if (length === 0) {
            return schema.defaultOutput;
        }

        const items : Record<string, FiltersParseOutputElement> = {};

        // transform to appreciate data format & validate input
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const value : unknown = data[keys[i]];

            if (
                typeof value !== 'string' &&
                typeof value !== 'number' &&
                typeof value !== 'boolean' &&
                typeof value !== 'undefined' &&
                value !== null &&
                !Array.isArray(value)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(keys[i]);
                }
                continue;
            }

            keys[i] = applyMapping(keys[i], schema.mapping);

            const fieldDetails : KeyDetails = parseKey(keys[i]);

            if (
                schema.allowedIsUndefined &&
                !isPropertyNameValid(fieldDetails.name)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }
                continue;
            }

            if (
                typeof fieldDetails.path !== 'undefined' &&
                !isPathAllowedByRelations(fieldDetails.path, options.relations)
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(fieldDetails.path);
                }
                continue;
            }

            const fullKey : string = buildKeyWithPath(fieldDetails);
            if (
                !schema.allowedIsUndefined &&
                schema.allowed &&
                !isPathCoveredByParseAllowedOption(schema.allowed, [keys[i], fullKey])
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }

                continue;
            }

            const filter = schema.transformParseOutputElement({
                key: fieldDetails.name,
                value: value as string | boolean | number,
            });

            if (Array.isArray(filter.value)) {
                const output : (string | number)[] = [];
                for (let j = 0; j < filter.value.length; j++) {
                    if (schema.validate(filter.key as NestedKeys<RECORD>, filter.value[j])) {
                        output.push(filter.value[j]);
                    } else if (schema.throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!schema.validate(filter.key as NestedKeys<RECORD>, filter.value)) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                typeof filter.value === 'string' &&
                filter.value.length === 0
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                Array.isArray(filter.value) &&
                filter.value.length === 0
            ) {
                if (schema.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (fieldDetails.path || schema.defaultPath) {
                filter.path = fieldDetails.path || schema.defaultPath;
            }

            items[fullKey] = filter;
        }

        return schema.buildParseOutput(items);
    }

    // --------------------------------------------------

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FiltersSchema<RECORD>) : FiltersSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.resolveBaseSchema(input);
            return schema.filters;
        }

        if (input instanceof FiltersSchema) {
            return input;
        }

        return defineFiltersSchema();
    }
}
