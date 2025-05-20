/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { KeyDetails } from '../../utils';
import {
    applyMapping,
    buildKeyWithPath,
    isObject,
    isPathAllowedByRelations,
    parseKey,
} from '../../utils';
import { isValidFieldName } from '../../parameter/fields';
import { isPathCoveredByParseAllowedOption } from '../../parameter/utils';
import { FiltersParseError } from '../../parameter/filters/errors';
import type { FiltersParseOutput, FiltersParseOutputElement } from '../../parameter/filters/types';
import { BaseParser } from '../module';
import type { RelationsParseOutput } from '../../parameter/relations';
import type { Schema, SchemaOptions } from '../../schema';

type FiltersParseOptions = {
    relations?: RelationsParseOutput,
    schema?: string | Schema | SchemaOptions
};

export class FiltersParser extends BaseParser<
FiltersParseOptions,
FiltersParseOutput
> {
    parse(
        data: unknown,
        options: FiltersParseOptions = {},
    ) : FiltersParseOutput {
        const schema = this.resolveSchema(options.schema);

        const container = schema.filters;

        // If it is an empty array nothing is allowed
        if (
            !container.allowedIsUndefined &&
            container.allowed.length === 0
        ) {
            return container.defaultOutput;
        }

        /* istanbul ignore next */
        if (!isObject(data)) {
            if (container.throwOnFailure) {
                throw FiltersParseError.inputInvalid();
            }

            return container.defaultOutput;
        }

        const { length } = Object.keys(data);
        if (length === 0) {
            return container.defaultOutput;
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
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(keys[i]);
                }
                continue;
            }

            keys[i] = applyMapping(keys[i], container.mapping);

            const fieldDetails : KeyDetails = parseKey(keys[i]);

            if (
                container.allowedIsUndefined &&
                !isValidFieldName(fieldDetails.name)
            ) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }
                continue;
            }

            if (
                typeof fieldDetails.path !== 'undefined' &&
                !isPathAllowedByRelations(fieldDetails.path, options.relations)
            ) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyPathInvalid(fieldDetails.path);
                }
                continue;
            }

            const fullKey : string = buildKeyWithPath(fieldDetails);
            if (
                !container.allowedIsUndefined &&
                container.allowed &&
                !isPathCoveredByParseAllowedOption(container.allowed, [keys[i], fullKey])
            ) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyInvalid(fieldDetails.name);
                }

                continue;
            }

            const filter = container.transformParseOutputElement({
                key: fieldDetails.name,
                value: value as string | boolean | number,
            });

            if (Array.isArray(filter.value)) {
                const output : (string | number)[] = [];
                for (let j = 0; j < filter.value.length; j++) {
                    if (container.validate(filter.key, filter.value[j])) {
                        output.push(filter.value[j]);
                    } else if (container.throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!container.validate(filter.key, filter.value)) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                typeof filter.value === 'string' &&
                filter.value.length === 0
            ) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (
                Array.isArray(filter.value) &&
                filter.value.length === 0
            ) {
                if (container.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }

            if (fieldDetails.path || container.defaultPath) {
                filter.path = fieldDetails.path || container.defaultPath;
            }

            items[fullKey] = filter;
        }

        return container.buildParseOutput(items);
    }
}
