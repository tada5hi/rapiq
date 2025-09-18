/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldsParseOutput } from 'rapiq';
import type { IFieldsAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type FieldsInterpreterOptions = InterpreterInterpretOptions;

export class FieldsInterpreter {
    interpret(
        input: FieldsParseOutput,
        adapter: IFieldsAdapter,
        options: FieldsInterpreterOptions = {},
    ) {
        adapter.clear();

        for (let i = 0; i < input.length; i++) {
            adapter.add(input[i], options.rootAlias);
        }

        const execute = options.execute ?? true;
        if (execute) {
            adapter.execute();
        }
    }
}
