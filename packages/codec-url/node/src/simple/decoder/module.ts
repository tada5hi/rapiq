/*
 * Copyright (c) 2025-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SimpleParser } from '@rapiq/parser-simple';
import type { SchemaRegistry } from '@rapiq/core';
import { BaseURLDecoder } from '../../decoder';

export class SimpleURLDecoder extends BaseURLDecoder {
    constructor(input?: SchemaRegistry) {
        super(new SimpleParser(input));
    }
}
