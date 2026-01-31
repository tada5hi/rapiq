/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ObjectLiteral,
} from '../../../types';
import type { FieldsSchema, Schema } from '../../../schema';
import type { ParseParameterOptions } from '../../types';

export type FieldsParseOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = Omit<ParseParameterOptions<RECORD>, 'schema'> & {
    schema?: string | Schema<RECORD> | FieldsSchema<RECORD>,
    isChild?: boolean
};
