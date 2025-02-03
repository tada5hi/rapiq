/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BuildInput } from '../build';
import { buildQuery } from '../build';
import type { ParseInput, ParseParametersOutput } from '../parse';
import { parseQuery } from '../parse';
import type { ObjectLiteral } from '../type';
import type { SchemaOptions } from './types';

export class Schema<T extends ObjectLiteral = ObjectLiteral> {
    protected options : SchemaOptions<T>;

    constructor(options: SchemaOptions<T>) {
        // todo: do ahead of parse/stringify options computation
        this.options = options;
    }

    stringify(input: BuildInput<T>) : string {
        // todo: validate input ?!
        return buildQuery(input);
    }

    parse(input: ParseInput) : ParseParametersOutput {
        return parseQuery(input, this.options);
    }

    print() {
        // todo: output formatted options!
    }
}
