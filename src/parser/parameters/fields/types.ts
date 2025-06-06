/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type FieldsParseOutputElement = {
    key: string,
    path?: string,
    value?: string
};
export type FieldsParseOutput = FieldsParseOutputElement[];

export type FieldsParseInputTransformed = {
    default: string[],
    included: string[],
    excluded: string[]
};
