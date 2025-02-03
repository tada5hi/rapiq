/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedKeys, ObjectLiteral } from '../../type';
import type { KeyDetails } from '../../utils';
import {
    applyMapping,
    buildKeyWithPath,
    isObject,
    isPathAllowedByRelations,
    parseKey,
} from '../../utils';
import { isValidFieldName } from '../fields';
import { isPathCoveredByParseAllowedOption } from '../utils';
import { FiltersOptionsContainer } from './container';
import { FiltersParseError } from './errors';
import type { FiltersParseOptions, FiltersParseOutput, FiltersParseOutputElement } from './type';

export function parseQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    data: unknown,
    options?: FiltersParseOptions<T> | FiltersOptionsContainer<T>,
) : FiltersParseOutput {
    let container : FiltersOptionsContainer<T>;
    if (options instanceof FiltersOptionsContainer) {
        container = options;
    } else {
        container = new FiltersOptionsContainer<T>(options);
    }

    // If it is an empty array nothing is allowed
    if (
        !container.allowedIsUndefined &&
        container.allowed.length === 0
    ) {
        return container.defaultOutput;
    }

    /* istanbul ignore next */
    if (!isObject(data)) {
        if (container.options.throwOnFailure) {
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
            if (container.options.throwOnFailure) {
                throw FiltersParseError.keyValueInvalid(keys[i]);
            }
            continue;
        }

        keys[i] = applyMapping(keys[i], container.options.mapping);

        const fieldDetails : KeyDetails = parseKey(keys[i]);

        if (
            container.allowedIsUndefined &&
            !isValidFieldName(fieldDetails.name)
        ) {
            if (container.options.throwOnFailure) {
                throw FiltersParseError.keyInvalid(fieldDetails.name);
            }
            continue;
        }

        if (
            typeof fieldDetails.path !== 'undefined' &&
            !isPathAllowedByRelations(fieldDetails.path, container.options.relations)
        ) {
            if (container.options.throwOnFailure) {
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
            if (container.options.throwOnFailure) {
                throw FiltersParseError.keyInvalid(fieldDetails.name);
            }

            continue;
        }

        const filter = container.transformParseOutputElement({
            key: fieldDetails.name,
            value: value as string | boolean | number,
        });

        if (container.options.validate) {
            if (Array.isArray(filter.value)) {
                const output : (string | number)[] = [];
                for (let j = 0; j < filter.value.length; j++) {
                    if (container.options.validate(filter.key as NestedKeys<T>, filter.value[j])) {
                        output.push(filter.value[j]);
                    } else if (container.options.throwOnFailure) {
                        throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                    }
                }

                filter.value = output as string[] | number[];
                if (filter.value.length === 0) {
                    continue;
                }
            } else if (!container.options.validate(filter.key as NestedKeys<T>, filter.value)) {
                if (container.options.throwOnFailure) {
                    throw FiltersParseError.keyValueInvalid(fieldDetails.name);
                }

                continue;
            }
        }

        if (
            typeof filter.value === 'string' &&
            filter.value.length === 0
        ) {
            if (container.options.throwOnFailure) {
                throw FiltersParseError.keyValueInvalid(fieldDetails.name);
            }

            continue;
        }

        if (
            Array.isArray(filter.value) &&
            filter.value.length === 0
        ) {
            if (container.options.throwOnFailure) {
                throw FiltersParseError.keyValueInvalid(fieldDetails.name);
            }

            continue;
        }

        if (fieldDetails.path || container.options.defaultPath) {
            filter.path = fieldDetails.path || container.options.defaultPath;
        }

        items[fullKey] = filter;
    }

    return container.buildParseOutput(items);
}
