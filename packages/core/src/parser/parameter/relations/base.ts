/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../../../parameter';
import { RelationsSchema, Schema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';

export abstract class BaseRelationsParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> extends BaseParser<OPTIONS, Relations> {
    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | RelationsSchema<RECORD>) : RelationsSchema<RECORD> | undefined {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.relations;
        }

        if (input instanceof RelationsSchema) {
            return input;
        }

        return undefined;
    }
}
