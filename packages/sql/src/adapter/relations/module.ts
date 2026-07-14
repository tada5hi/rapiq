/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsBaseAdapter } from './base';
import type { RelationsAdapterOptions } from './types';

export class RelationsAdapter extends RelationsBaseAdapter {
    protected options : RelationsAdapterOptions;

    // -----------------------------------------------------------

    constructor(options: RelationsAdapterOptions = {}) {
        super(options);

        this.options = options;
    }

    // -----------------------------------------------------------

    execute() {

    }
}
