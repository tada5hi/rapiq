/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldsParseOutput } from 'rapiq';
import type { FieldsContainer } from '../container';

export type FieldsInterpreterOptions = {
    rootAlias?: string
};

export class FieldsInterpreter {
    interpret(
        input: FieldsParseOutput,
        data: FieldsContainer,
        options: FieldsInterpreterOptions = {},
    ) {
        for (let i = 0; i < input.length; i++) {
            data.add(input[i], options.rootAlias);
        }

        data.apply();
    }
}
