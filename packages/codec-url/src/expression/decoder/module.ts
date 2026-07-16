/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ExpressionParser } from '@rapiq/parser-expression';
import type { SchemaRegistry } from '@rapiq/core';
import { BaseURLDecoder } from '../../decoder';

export class ExpressionURLDecoder extends BaseURLDecoder {
    constructor(input?: SchemaRegistry) {
        super(new ExpressionParser(input));
    }

    /**
     * The expression dialect has no bare-object filter form: input
     * without the filter wire parameter falls back to schema
     * defaults. An empty `filter=` IS present and surfaces the
     * parser's syntax error — the dialect is precise.
     */
    protected override filtersFallback() : unknown {
        return undefined;
    }
}
