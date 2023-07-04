/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from './object';

export function applyMapping(
    name: string,
    map?: Record<string, string>,
    onlyKey?: boolean,
) {
    if (typeof map === 'undefined') {
        return name;
    }

    const keys = Object.keys(map);
    if (keys.length === 0) {
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

        if (hasOwnProperty(map, value)) {
            output.push(map[value]);
        } else {
            let found = false;

            const rest : string[] = [];
            const copy = [...parts];
            while (copy.length > 0) {
                const key = [value, ...copy].join('.');
                if (hasOwnProperty(map, key)) {
                    output.push(map[key]);
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
        return output.pop() || name;
    }

    if (output.length === 0) {
        return name;
    }

    return output.join('.');
}
