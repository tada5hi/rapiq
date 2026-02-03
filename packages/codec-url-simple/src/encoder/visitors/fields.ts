/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Field,
    Fields,
    IFieldVisitor,

    IFieldsVisitor,
} from '@rapiq/core';
import {
    DEFAULT_ID, parseKey,
} from '@rapiq/core';
import { URLParameter } from '../../constants';
import { RecordArraySerializer } from '../serializer';

export class FieldsVisitor implements IFieldsVisitor<RecordArraySerializer>,
IFieldVisitor<RecordArraySerializer> {
    protected serializer : RecordArraySerializer;

    constructor(serializer?: RecordArraySerializer) {
        this.serializer = serializer || new RecordArraySerializer(
            URLParameter.FIELDS,
        );
    }

    visitFields(expr: Fields): RecordArraySerializer {
        for (let i = 0; i < expr.value.length; i++) {
            expr.value[i].accept(this);
        }

        return this.serializer;
    }

    visitField(expr: Field): RecordArraySerializer {
        const key = parseKey(expr.name);

        this.serializer.add(
            key.path || DEFAULT_ID,
            expr.operator ?
                expr.operator + key.name :
                key.name,
        );

        return this.serializer;
    }
}
