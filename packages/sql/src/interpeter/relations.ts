/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from 'rapiq';
import type { RelationsContainer } from '../container';

export type RelationInterpreterOptions = {
    rootAlias?: string
};

export class RelationsInterpreter {
    interpret(
        input: RelationsParseOutput,
        data: RelationsContainer,
        options: RelationInterpreterOptions = {},
    ) {
        for (let i = 0; i < input.length; i++) {
            data.add(input[i], options.rootAlias);
        }

        data.apply(options.rootAlias);
    }
}
