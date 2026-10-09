/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Field,
    Fields,
    Query,
    defineQuery,
    defineSchema,
    eq,
    isFilter,
} from '@rapiq/core';
import type { ICondition, IFields, IQuery } from '@rapiq/core';
import { ExpressionURLEncoder } from '../../src/expression';
import { SimpleURLEncoder } from '../../src/simple';
import { URL_SIMPLE_CODEC, createURLCodec } from '../../src';
import { registry } from '../data/schema';
import type { User } from '../data/type';

/**
 * A `Field.condition` (issue #830) says "this column is visible only on
 * rows satisfying C". It is derived server-side by a `fields.validate`
 * hook and has no wire form in any dialect, so it must never round-trip
 * onto a URL.
 *
 * Encoding one is therefore a typed `FEATURE_UNSUPPORTED` failure, not
 * a silent drop: emitting the bare field name would hand the next hop
 * an ungated projection of a gated column. Since a client can never
 * author a condition, the guard is unreachable from the ordinary
 * client-side encode path.
 */
describe('fields condition', () => {
    function gatedQuery(condition: ICondition = eq('id', 1)) : IQuery {
        return new Query({
            fields: new Fields([
                new Field('id'),
                new Field('email', undefined, condition),
            ]),
        });
    }

    function expectFeatureUnsupported(fn: () => unknown) {
        try {
            fn();
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        }
    }

    describe('encode refuses to emit it', () => {
        it('should throw a typed error on the simple encoder', () => {
            const encoder = new SimpleURLEncoder(registry);

            expectFeatureUnsupported(() => encoder.encode(gatedQuery()));
        });

        it('should throw a typed error on the expression encoder', () => {
            const encoder = new ExpressionURLEncoder(registry);

            expectFeatureUnsupported(() => encoder.encode(gatedQuery()));
        });

        it('should throw a typed error on the codec facade (expression default)', () => {
            const codec = createURLCodec(registry);

            expectFeatureUnsupported(() => codec.encode(gatedQuery()));
        });

        it('should throw a typed error on the codec facade (explicit simple)', () => {
            const codec = createURLCodec(registry);

            expectFeatureUnsupported(() => codec.encode(
                gatedQuery(),
                { codec: URL_SIMPLE_CODEC },
            ));
        });

        it('should throw for the fields parameter encoded on its own', () => {
            const simple = new SimpleURLEncoder(registry);
            const expression = new ExpressionURLEncoder(registry);
            const { fields } = gatedQuery();

            expectFeatureUnsupported(() => simple.encodeFields(fields));
            expectFeatureUnsupported(() => expression.encodeFields(fields));
            expectFeatureUnsupported(() => simple.encodeField(fields.value[1]));
        });

        it('should throw for a gated field under a relation path', () => {
            const encoder = new SimpleURLEncoder(registry);
            const query = new Query({
                fields: new Fields([
                    new Field('id'),
                    new Field('realm.name', undefined, eq('id', 1)),
                ]),
            });

            expectFeatureUnsupported(() => encoder.encode(query));
        });

        it('should not emit a partial wire alongside the failure', () => {
            const encoder = new SimpleURLEncoder(registry);

            expectFeatureUnsupported(() => encoder.encode(gatedQuery()));

            // a thrown encode must not leak serializer state into the next
            // call: the ungated retry emits only its own fields.
            expect(decodeURIComponent(encoder.encode(defineQuery({ fields: ['id'] }))!))
                .toEqual('fields=id');
        });

        it('should throw async as well', async () => {
            const simple = new SimpleURLEncoder(registry);
            const expression = new ExpressionURLEncoder(registry);

            await expect(simple.encodeAsync(gatedQuery())).rejects.toThrowError(AdapterError);
            await expect(expression.encodeAsync(gatedQuery())).rejects.toThrowError(AdapterError);
        });
    });

    describe('schema-aware encode keeps the gated field on the wire', () => {
        /**
         * A condition verdict is an *acceptance*: the field stays
         * requestable, only its value is gated. The schema-aware pass
         * re-runs the schema's validate hook through its internal
         * decoder, so it derives conditions of its own. Those must be
         * discarded, not tripped over. Encoding must keep behaving like
         * the wire the server would accept.
         */
        const schema = defineSchema<User>({
            fields: {
                allowed: ['id', 'name', 'email'],
                validate: (name) => (name === 'email' ? eq('id', 1) : true),
            },
        });

        const asyncSchema = defineSchema<User>({
            fields: {
                allowed: ['id', 'name', 'email'],
                validate: async (name) => (name === 'email' ? eq('id', 1) : true),
            },
        });

        const manySchema = defineSchema<User>({
            fields: {
                allowed: ['id', 'name', 'email'],
                validateMany: (names) => names.reduce<Record<string, any>>(
                    (record, name) => {
                        record[name] = name === 'email' ? eq('id', 1) : true;

                        return record;
                    },
                    {},
                ),
            },
        });

        const query = defineQuery({ fields: ['id', 'email'] });

        it('should encode with the simple dialect', () => {
            const encoder = new SimpleURLEncoder(registry);

            expect(decodeURIComponent(encoder.encode(query, { schema })!))
                .toEqual('fields=id,email');
        });

        it('should encode with the expression dialect', () => {
            const encoder = new ExpressionURLEncoder(registry);

            expect(decodeURIComponent(encoder.encode(query, { schema })!))
                .toEqual('fields=id,email');
        });

        it('should encode the fields parameter on its own', () => {
            const simple = new SimpleURLEncoder(registry);
            const expression = new ExpressionURLEncoder(registry);

            expect(decodeURIComponent(simple.encodeFields(query.fields, { schema })!))
                .toEqual('fields=id,email');
            expect(decodeURIComponent(expression.encodeFields(query.fields, { schema })!))
                .toEqual('fields=id,email');
        });

        it('should encode a batched (validateMany) condition verdict', () => {
            const simple = new SimpleURLEncoder(registry);
            const expression = new ExpressionURLEncoder(registry);

            expect(decodeURIComponent(simple.encode(query, { schema: manySchema })!))
                .toEqual('fields=id,email');
            expect(decodeURIComponent(expression.encode(query, { schema: manySchema })!))
                .toEqual('fields=id,email');
        });

        it('should encode asynchronously', async () => {
            const simple = new SimpleURLEncoder(registry);
            const expression = new ExpressionURLEncoder(registry);

            expect(decodeURIComponent((await simple.encodeAsync(query, { schema: asyncSchema }))!))
                .toEqual('fields=id,email');
            expect(decodeURIComponent(
                (await expression.encodeAsync(query, { schema: asyncSchema }))!,
            )).toEqual('fields=id,email');
        });

        it('should re-derive the gate on the receiving side instead of transporting it', () => {
            const codec = createURLCodec(registry);

            const encoded = codec.encode(query, { schema });
            expect(decodeURIComponent(encoded!)).toEqual(
                'codec=url-expression&fields=id,email',
            );

            const decoded = codec.decode(encoded!, { schema });

            expect(conditionOf(decoded!.fields, 'id')).toBeUndefined();
            const condition = conditionOf(decoded!.fields, 'email');
            expect(isFilter(condition!)).toBeTruthy();
        });
    });

    function conditionOf(fields: IFields, name: string) : ICondition | undefined {
        return fields.value.find((field) => field.name === name)?.condition;
    }
});
