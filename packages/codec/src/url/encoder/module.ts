/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, Query } from 'rapiq';
import type { IEncoder } from '../../types';
import { Interpreter } from './interpreters';

export class URLEncoder implements IEncoder<string> {
    protected interpreter : Interpreter;

    constructor() {
        this.interpreter = new Interpreter();
    }

    encode(input: Query): any {
        return this.interpreter.interpret(input);
    }

    encodeFilters(input: Condition) {
        return this.interpreter.interpretFilters(input);
    }
}
