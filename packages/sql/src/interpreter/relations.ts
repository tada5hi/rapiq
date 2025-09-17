/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from 'rapiq';
import type { IRelationsAdapter } from '../adapter';

export type RelationInterpreterOptions = {
    rootAlias?: string
};

export class RelationsInterpreter {
    interpret(
        input: RelationsParseOutput,
        adapter: IRelationsAdapter,
        options: RelationInterpreterOptions = {},
    ) {
        adapter.clear();

        for (let i = 0; i < input.length; i++) {
            adapter.add(input[i], options.rootAlias);
        }

        adapter.execute(options.rootAlias);
    }
}
