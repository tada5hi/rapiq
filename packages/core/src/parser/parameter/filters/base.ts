/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '../../../parameter';
import { FiltersSchema, Schema, defineFiltersSchema } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { BaseParser } from '../../base';

export abstract class BaseFiltersParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
> extends BaseParser<OPTIONS, Condition> {
    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input?: string | Schema<RECORD> | FiltersSchema<RECORD>) : FiltersSchema<RECORD> {
        if (typeof input === 'string' || input instanceof Schema) {
            const schema = this.getBaseSchema(input);
            return schema.filters;
        }

        if (input instanceof FiltersSchema) {
            return input;
        }

        return defineFiltersSchema();
    }
}
