/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function isValidRelationPath(input: string) : boolean {
    return /^[a-zA-Z0-9_-]+([.]*[a-zA-Z0-9_-])*$/gu.test(input);
}
