/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function parseFieldsInput(input: unknown): string[] {
    let output: string[] = [];

    if (typeof input === 'string') {
        output = input.split(',');
    } else if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            if (typeof input[i] === 'string') {
                output.push(input[i]);
            }
        }
    }

    return output;
}
