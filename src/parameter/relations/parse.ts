/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../type';
import { applyMapping, hasOwnProperty } from '../../utils';
import { isPathCoveredByParseAllowedOption } from '../utils';
import { RelationsParseError } from './errors';

import type { RelationsParseOptions, RelationsParseOutput } from './type';
import { includeParents, isValidRelationPath } from './utils';

// --------------------------------------------------

export function parseQueryRelations<T extends ObjectLiteral = ObjectLiteral>(
    input: unknown,
    options: RelationsParseOptions<T> = {},
): RelationsParseOutput {
    // If it is an empty array nothing is allowed
    if (
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return [];
    }

    options.mapping = options.mapping || {};
    options.pathMapping = options.pathMapping || {};
    if (typeof options.includeParents === 'undefined') {
        options.includeParents = true;
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
    } else if (options.throwOnFailure) {
        throw RelationsParseError.inputInvalid();
    }

    if (items.length === 0) {
        return [];
    }

    const mappingKeys = Object.keys(options.mapping);
    if (mappingKeys.length > 0) {
        for (let i = 0; i < items.length; i++) {
            items[i] = applyMapping(items[i], options.mapping);
        }
    }

    for (let j = items.length - 1; j >= 0; j--) {
        let isValid : boolean;
        if (options.allowed) {
            isValid = isPathCoveredByParseAllowedOption(options.allowed as string[], items[j]);
        } else {
            isValid = isValidRelationPath(items[j]);
        }

        if (!isValid) {
            if (options.throwOnFailure) {
                throw RelationsParseError.keyInvalid(items[j]);
            }

            items.splice(j, 1);
        }
    }

    if (options.includeParents) {
        if (Array.isArray(options.includeParents)) {
            const parentIncludes = items.filter(
                (item) => item.includes('.') &&
                    (options.includeParents as string[]).filter((parent) => item.startsWith(parent)).length > 0,
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
                options.pathMapping &&
                hasOwnProperty(options.pathMapping, key)
            ) {
                value = options.pathMapping[key];
            } else {
                value = parts.pop() as string;
            }

            return {
                key,
                value,
            };
        });
}
