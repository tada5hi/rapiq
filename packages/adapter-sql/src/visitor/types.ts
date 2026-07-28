/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type VisitorOptions = {
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default —
     * e.g. identifier or token columns. Typically forwarded from
     * a schema's `filters.caseSensitive` list.
     */
    caseSensitive?: string[],

    [key: string]: any;
};
