/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function hasOwnProperty<
    X extends Record<string, any>,
    Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Build alias mapping from strings in array or object representation to object representation.
 *
 * {field1: 'field1', ...} => {field1: 'field1', ...}
 * ['field1', 'field2'] => {field1: 'field1', field2: 'field2'}
 *
 * @param rawFields
 */
export function buildObjectFromStringArray(
    rawFields: string[] | Record<string, string>,
): Record<string, string> {
    if (Array.isArray(rawFields)) {
        const record: Record<string, any> = {};

        rawFields
            .filter((field) => typeof field === 'string')
            .map((field) => {
                record[field] = field;

                return field;
            });

        return record;
    }

    return rawFields;
}
