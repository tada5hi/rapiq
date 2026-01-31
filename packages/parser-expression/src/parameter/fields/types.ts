/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import type { SimpleFieldsParseOptions } from '@rapiq/parser-simple';
import type { ObjectLiteral } from '@rapiq/core';

export type ExpressionFieldsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = SimpleFieldsParseOptions<RECORD>;
