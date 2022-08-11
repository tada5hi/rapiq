/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from './object';

export function getNameByAliasMapping(
    name: string,
    aliasMapping?: Record<string, string>,
    onlyKey?: boolean,
) {
    if (typeof aliasMapping === 'undefined') {
        return name;
    }

    let parts = name.split('.');

    const output = [];
    let run = true;
    while (run) {
        const value = parts.shift();
        if (typeof value === 'undefined') {
            run = false;
            break;
        }

        if (hasOwnProperty(aliasMapping, value)) {
            output.push(aliasMapping[value]);
        } else {
            let found = false;

            const rest : string[] = [];
            const copy = [...parts];
            while (copy.length > 0) {
                const key = [value, ...copy].join('.');
                if (hasOwnProperty(aliasMapping, key)) {
                    output.push(aliasMapping[key]);
                    found = true;
                    break;
                } else {
                    const last = copy.pop();
                    if (last) {
                        rest.unshift(last);
                    }
                }
            }

            if (found) {
                parts = rest;
            } else {
                output.push(value);
            }
        }
    }

    if (onlyKey) {
        return output.pop();
    }

    return output.join('.');
}
