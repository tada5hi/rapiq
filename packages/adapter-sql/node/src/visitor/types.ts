/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type VisitorOptions = {
    /**
     * Field keys whose equality (eq/ne/in/nin) and anchored
     * (startsWith/endsWith/contains) comparisons stay
     * case-sensitive instead of the case-insensitive default, e.g.
     * identifier or token columns; `true` opts every field out.
     * Typically forwarded from a schema's `filters.caseSensitive`
     * list.
     */
    caseSensitive?: string[] | boolean,

    [key: string]: any;
};
