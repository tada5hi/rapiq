/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ObjectLiteral } from '../../type';
import { applyMapping, hasOwnProperty } from '../../utils';
import { isPathCoveredByParseAllowedOption } from '../utils';

import { RelationsParseOptions, RelationsParseOutput } from './type';
import { includeParents, isValidRelationPath } from './utils';

// --------------------------------------------------

export function parseQueryRelations<T extends ObjectLiteral = ObjectLiteral>(
    data: unknown,
    options?: RelationsParseOptions<T>,
): RelationsParseOutput {
    options ??= {};

    // If it is an empty array nothing is allowed
    if (
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return [];
    }

    options.mapping = options.mapping || {};
    options.pathMapping = options.pathMapping || {};
    options.includeParents ??= true;

    let items: string[] = [];

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return [];
    }

    if (prototype === '[object String]') {
        items = (data as string).split(',');
    }

    if (prototype === '[object Array]') {
        items = (data as any[]).filter((el) => typeof el === 'string');
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

    if (options.allowed) {
        items = items.filter((item) => isPathCoveredByParseAllowedOption(options.allowed, item));
    } else {
        items = items.filter((item) => isValidRelationPath(item));
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
                value = parts.pop();
            }

            return {
                key,
                value,
            };
        });
}
