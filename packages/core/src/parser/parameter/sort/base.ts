/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISorts } from '../../../parameter';
import { Schema, SortSchema, defineSortSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';

export abstract class BaseSortParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> extends BaseParser<OPTIONS, ISorts> {
    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | SortSchema<RECORD>) : SortSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.sort;
        }

        if (input instanceof SortSchema) {
            return input;
        }

        return defineSortSchema();
    }
}
