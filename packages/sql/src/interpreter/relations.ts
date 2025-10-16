/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from 'rapiq';
import type { IRelationsAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type RelationInterpreterOptions = InterpreterInterpretOptions;

export class RelationsInterpreter {
    interpret(
        input: Relations,
        adapter: IRelationsAdapter,
        options: RelationInterpreterOptions = {},
    ) {
        adapter.clear();

        for (let i = 0; i < input.value.length; i++) {
            adapter.add(input.value[i].name, options.rootAlias);
        }

        const execute = options.execute ?? true;
        if (execute) {
            adapter.execute(options.rootAlias);
        }
    }
}
