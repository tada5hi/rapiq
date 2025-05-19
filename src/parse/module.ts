/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineSchema } from '../schema';
import type { ObjectLiteral } from '../types';
import type { ParseInput, ParseOptions, ParseOutput } from './types';

export function parseQuery<T extends ObjectLiteral = ObjectLiteral>(
    input: ParseInput,
    options: ParseOptions<T> = {},
) : ParseOutput {
    const parser = defineSchema<T>(options);

    return parser.parseQuery(input);
}
