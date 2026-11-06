/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type Predicate = (input: unknown) => boolean;

export type Comparator<T = any> = (a: T, b: T) => number;

export type Projector<T = any> = (input: T) => T;

export type Slicer = <T>(data: T[]) => T[];

export type ApplyOutput<T> = {
    data: T[],

    total: number,

    pagination: {
        limit?: number,
        offset?: number
    }
};



export type QueryVisitorOptions = {
    /**
     * Field keys whose equality (eq/ne/in/nin) and anchored
     * (startsWith/endsWith/contains) comparisons stay
     * case-sensitive instead of the case-insensitive default;
     * `true` opts every field out. Typically forwarded from a
     * schema's `filters.caseSensitive` list.
     */
    caseSensitive?: string[] | boolean,
};
