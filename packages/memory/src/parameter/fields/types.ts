/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersVisitorOptions } from '../filters';

export type FieldsVisitorOptions = {
    /**
     * Included relation paths: an included relation keeps its
     * whole subtree alongside the selected fields.
     */
    relations?: string[],

    /**
     * Options for compiling the visibility gate conditions carried
     * by the fields (`Field.condition`). The same knobs the query's
     * filters are compiled with.
     */
    filters?: FiltersVisitorOptions
};
