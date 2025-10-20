/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Fields } from '../../../parameter';
import { FieldsSchema, Schema, defineFieldsSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';

export abstract class BaseFieldsParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> extends BaseParser<OPTIONS, Fields> {
    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FieldsSchema<RECORD>) : FieldsSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.fields;
        }

        if (input instanceof FieldsSchema) {
            return input;
        }

        return defineFieldsSchema();
    }
}
