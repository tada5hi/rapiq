/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SortParseOutput } from 'rapiq';
import type { ISortAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type SortInterpreterOptions = InterpreterInterpretOptions;

export class SortInterpreter {
    interpret(
        input: SortParseOutput,
        adapter: ISortAdapter,
        options: SortInterpreterOptions = {},
    ) {
        adapter.clear();

        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            adapter.add(keys[i], input[keys[i]], options.rootAlias);
        }

        const execute = options.execute ?? true;
        if (execute) {
            adapter.execute(options.rootAlias);
        }
    }
}
