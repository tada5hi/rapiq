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
    AdapterError,
    DEFAULT_ID,
    parseKey,
} from '@rapiq/core';
import { URLParameter } from '../../../constants';
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
        for (const item of expr.value) {
            item.accept(this);
        }

        return this.serializer;
    }

    visitField(expr: Field): RecordArraySerializer {
        // subset law: a field visibility condition is a server-side
        // authorization artifact with no wire form in any dialect. It
        // must never round-trip onto a URL. Emitting the bare name would
        // hand the next hop an ungated projection of a gated column, a
        // silent widening of what the query discloses, so the encoder
        // refuses instead. A client can never author a condition, so this
        // is unreachable from the client-side encode path; it fires only
        // when a server-parsed, gated query is re-encoded (a gateway
        // forwarding a request), which is exactly the case that must not
        // pass unnoticed. The schema-aware pass strips the conditions its
        // own validation round trip derives (see stripFieldConditions):
        // those are acceptances, not caller input.
        if (typeof expr.condition !== 'undefined') {
            throw AdapterError.featureUnsupported('fields:condition');
        }

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
