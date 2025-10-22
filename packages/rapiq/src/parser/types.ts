/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../parameter';
import type { Schema } from '../schema';
import type { ObjectLiteral } from '../types';

export type ParseParameterOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = IParserOptions & {
    schema?: Schema<RECORD> | string,
    relations?: Relations,
};

export type IParserOptions = {
    async?: boolean,
};

export interface IParser<
Input = any,
Output = any,
Options extends IParserOptions = IParserOptions,
> {
    parse(input: Input, options?: Options): Output;
}
