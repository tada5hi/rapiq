/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Sorts } from 'rapiq';
import type { ISortAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type SortInterpreterOptions = InterpreterInterpretOptions;

export class SortInterpreter {
    interpret(
        input: Sorts,
        adapter: ISortAdapter,
        options: SortInterpreterOptions = {},
    ) {
        adapter.clear();

        for (let i = 0; i < input.value.length; i++) {
            adapter.add(input.value[i].name, input.value[i].operator, options.rootAlias);
        }

        const execute = options.execute ?? true;
        if (execute) {
            adapter.execute(options.rootAlias);
        }
    }
}
