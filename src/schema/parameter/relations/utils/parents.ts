/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function includeParents(
    data: string[],
) : string[] {
    for (let i = 0; i < data.length; i++) {
        const parts: string[] = data[i].split('.');

        while (parts.length > 0) {
            parts.pop();

            if (parts.length > 0) {
                const value = parts.join('.');
                if (data.indexOf(value) === -1) {
                    data.unshift(value);
                }
            }
        }
    }

    return data;
}
