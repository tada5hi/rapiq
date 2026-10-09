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
