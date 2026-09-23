/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { flattenIssueItems } from '@ebec/core';
import type { IssueItem } from '@ebec/core';
import {
    Aggregates,
    ErrorCode,
    ErrorMessage,
    Field,
    Fields,
    Group,
    Groups,
    Parameter,
    ParseError,
    Sort,
    SortDirection,
    Sorts,
    defineSchema,
    eq,
} from '@rapiq/core';
import type {
    IAggregate,
    IGroup,
    SchemaError,
} from '@rapiq/core';
import { SimpleGroupsParser, SimpleParser } from '../../../src';
import { expectRejected, registry } from '../../data';

const OPT_IN = { groups: true, aggregates: true };

function issuesOf(run: () => unknown) : IssueItem[] {
    try {
        run();
    } catch (e) {
        expect(e).toBeInstanceOf(ParseError);

        return flattenIssueItems((e as ParseError).issues);
    }

    return [];
}

type Rejection = {
    parameter: 'groups' | 'aggregates',
    input: string,
    code: ErrorCode,
    message: string,
};

const BOUND_REJECTIONS : Rejection[] = [
    {
        parameter: 'groups',
        input: 'realm.id',
        code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        message: ErrorMessage.keyPathNotPermitted('realm.id'),
    },
    {
        parameter: 'groups',
        input: 'bucket(realm.createdAt,day)',
        code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        message: ErrorMessage.keyPathNotPermitted('realm.createdAt'),
    },
    {
        parameter: 'groups',
        input: '1foo',
        code: ErrorCode.KEY_INVALID,
        message: ErrorMessage.keyInvalid('1foo'),
    },
    {
        parameter: 'groups',
        input: 'email',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('email'),
    },
    {
        parameter: 'groups',
        input: 'scope(day)',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('scope'),
    },
    {
        parameter: 'groups',
        input: 'bucket(createdAt)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('bucket'),
    },
    {
        parameter: 'groups',
        input: 'bucket(updatedAt,day)',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('updatedAt'),
    },
    {
        parameter: 'groups',
        input: 'bucket(createdAt,week)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('bucket'),
    },
    {
        parameter: 'groups',
        input: 'period(month)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('period'),
    },
    {
        parameter: 'groups',
        input: 'period(createdAt,day)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('period'),
    },
    {
        parameter: 'aggregates',
        input: 'avg(amount)',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('avg'),
    },
    {
        parameter: 'aggregates',
        input: 'count(amount)',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('amount'),
    },
    {
        parameter: 'aggregates',
        input: 'sum',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('sum'),
    },
    {
        parameter: 'aggregates',
        input: 'revenue(amount)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('revenue'),
    },
    {
        parameter: 'aggregates',
        input: 'total(couponId)',
        code: ErrorCode.KEY_NOT_ALLOWED,
        message: ErrorMessage.keyNotPermitted('couponId'),
    },
];

const UNBOUND_REJECTIONS : Rejection[] = [
    {
        parameter: 'groups',
        input: 'avg(amount)',
        code: ErrorCode.OPERATOR_UNSUPPORTED,
        message: ErrorMessage.operatorUnsupported('avg'),
    },
    {
        parameter: 'groups',
        input: 'period(day)',
        code: ErrorCode.OPERATOR_UNSUPPORTED,
        message: ErrorMessage.operatorUnsupported('period'),
    },
    {
        parameter: 'groups',
        input: 'bucket(createdAt,week)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('bucket'),
    },
    {
        parameter: 'groups',
        input: 'realm.id',
        code: ErrorCode.KEY_PATH_NOT_ALLOWED,
        message: ErrorMessage.keyPathNotPermitted('realm.id'),
    },
    {
        parameter: 'aggregates',
        input: 'scope',
        code: ErrorCode.OPERATOR_UNSUPPORTED,
        message: ErrorMessage.operatorUnsupported('scope'),
    },
    {
        parameter: 'aggregates',
        input: 'count(a,b)',
        code: ErrorCode.KEY_VALUE_INVALID,
        message: ErrorMessage.callArgumentsInvalid('count'),
    },
];

describe('src/module.ts: groups and aggregates', () => {
    const parser = new SimpleParser(registry);

    describe('opt-in', () => {
        it('should ignore both parameters unless the parse opts in', () => {
            const query = parser.parse(
                {
                    groups: 'email',
                    aggregates: 'avg(x)',
                    fields: ['id'],
                },
                { schema: 'event' },
            );

            expect(query.groups).toEqual(new Groups());
            expect(query.aggregates).toEqual(new Aggregates());
            expect(query.fields).toEqual(new Fields([new Field('id')]));
        });

        it('should parse a parameter listed in parameters', () => {
            const query = parser.parse({ groups: 'scope' }, { schema: 'event', parameters: ['groups'] });

            expect(query.groups.value.map((group) => group.key)).toEqual(['scope']);
        });
    });

    describe('the issue URL', () => {
        it('should parse bucket(createdAt,day),scope,name with count', () => {
            const query = parser.parse({
                filters: { realmId: '1' },
                groups: 'bucket(createdAt,day),scope,name',
                aggregates: 'count',
                sorts: '-count',
            }, { schema: 'event', ...OPT_IN });

            expect(query.groups).toEqual(new Groups([
                new Group({
                    name: 'bucket',
                    params: ['createdAt', 'day'],
                    lowering: {
                        fn: 'bucket',
                        field: 'createdAt',
                        args: ['day'],
                    },
                }),
                new Group({
                    name: 'scope',
                    lowering: {
                        fn: undefined,
                        field: 'scope',
                        args: [],
                    },
                }),
                new Group({
                    name: 'name',
                    lowering: {
                        fn: undefined,
                        field: 'name',
                        args: [],
                    },
                }),
            ]));
            expect(query.aggregates.value.map((item) => item.key)).toEqual(['count']);
            expect(query.sorts).toEqual(new Sorts([new Sort('count', SortDirection.DESC)]));
            expect(query.fields).toEqual(new Fields());
            expect(query.filters.value).toHaveLength(1);
        });
    });

    describe('resolution (bound)', () => {
        it.each(BOUND_REJECTIONS)('should reject $parameter=$input with $code', ({
            parameter,
            input,
            code,
            message,
        }) => {
            expectRejected(() => parser.parse({ [parameter]: input }, { schema: 'event', ...OPT_IN }), { code, message });
        });

        it('should reject every term under a schema without the blocks', () => {
            const items = issuesOf(() => parser.parse({ groups: 'name', aggregates: 'count' }, { schema: 'user', ...OPT_IN }));

            expect(items.map((item) => item.message)).toEqual([
                ErrorMessage.keyNotPermitted('name'),
                ErrorMessage.keyNotPermitted('count'),
            ]);
        });
    });

    describe('resolution (unbound)', () => {
        const unbound = new SimpleParser();

        it.each(UNBOUND_REJECTIONS)('should reject $parameter=$input with $code', ({
            parameter,
            input,
            code,
            message,
        }) => {
            expectRejected(() => unbound.parse({ [parameter]: input }, OPT_IN), { code, message });
        });

        it('should accept primitives and bare columns', () => {
            const query = unbound.parse({ groups: 'bucket(createdAt,hour),scope', aggregates: 'count,sum(amount)' }, OPT_IN);

            expect(query.groups.value.map((item) => item.key)).toEqual(['createdAt', 'scope']);
            expect(query.aggregates.value.map((item) => item.key)).toEqual(['count', 'sumAmount']);
        });
    });

    describe('failure policy', () => {
        it('should raise a rejection even when the policy drops', () => {
            expectRejected(
                () => parser.parse({ groups: 'email' }, {
                    schema: 'event',
                    throwOnFailure: false,
                    ...OPT_IN,
                }),
                { code: ErrorCode.KEY_NOT_ALLOWED },
            );
        });

        it('should report every bad term of a request', () => {
            const items = issuesOf(() => parser.parse({ groups: 'email,phone', aggregates: 'avg(x)' }, { schema: 'event', ...OPT_IN }));

            expect(items.map((item) => item.path)).toEqual([['email'], ['phone'], ['avg']]);
        });

        it('should keep parsing the other parameters after a grammar violation', () => {
            const items = issuesOf(() => parser.parse({ groups: 'scope,,name', aggregates: 'avg(x)' }, { schema: 'event', ...OPT_IN }));

            expect(items.map((item) => item.code)).toEqual([ErrorCode.SYNTAX_INVALID, ErrorCode.KEY_NOT_ALLOWED]);
        });
    });

    describe('output keys', () => {
        it('should reject the same key twice within a parameter', () => {
            expectRejected(
                () => parser.parse({ aggregates: 'count,count()' }, { schema: 'event', ...OPT_IN }),
                { code: ErrorCode.KEY_AMBIGUOUS, message: ErrorMessage.outputKeyDuplicate('count') },
            );
        });

        it('should reject an aggregate key equal to a group key', () => {
            const items = issuesOf(() => new SimpleParser().parse({ groups: 'count', aggregates: 'count' }, OPT_IN));

            expect(items).toEqual([expect.objectContaining({
                code: ErrorCode.KEY_AMBIGUOUS,
                path: ['count'],
                meta: { parameter: Parameter.AGGREGATES },
            })]);
        });
    });

    describe('grouped mode', () => {
        it('should reject client fields', () => {
            expectRejected(
                () => parser.parse({ groups: 'scope', fields: ['id'] }, { schema: 'event', ...OPT_IN }),
                { code: ErrorCode.FEATURE_UNSUPPORTED, message: ErrorMessage.featureUnsupported('fields:grouped') },
            );
        });

        it.each([[''], [[]], [['']]])('should treat empty fields input %j as absent', (fields) => {
            const query = parser.parse({ groups: 'scope', fields }, { schema: 'event', ...OPT_IN });

            expect(query.fields).toEqual(new Fields());
        });

        it('should treat empty fields input as absent asynchronously', async () => {
            const query = await parser.parseAsync({ groups: 'scope', fields: '' }, { schema: 'event', ...OPT_IN });

            expect(query.fields).toEqual(new Fields());
        });

        it('should accept a sort on any output key', () => {
            const query = parser.parse(
                {
                    groups: 'bucket(createdAt,day),scope',
                    aggregates: 'count(couponId),total(fee)',
                    sorts: '-createdAt,-countCouponId,scope,totalFee',
                },
                { schema: 'event', ...OPT_IN },
            );

            expect(query.sorts).toEqual(new Sorts([
                new Sort('createdAt', SortDirection.DESC),
                new Sort('countCouponId', SortDirection.DESC),
                new Sort('scope', SortDirection.ASC),
                new Sort('totalFee', SortDirection.ASC),
            ]));
        });

        it('should drop a sort on a column and not apply the sorts default', () => {
            const query = parser.parse(
                {
                    groups: 'scope',
                    aggregates: 'count',
                    sorts: 'createdAt',
                },
                { schema: 'event', ...OPT_IN },
            );

            expect(query.sorts).toEqual(new Sorts());
        });

        it('should reject a sort on a column under a throwing policy', () => {
            expectRejected(
                () => parser.parse({ groups: 'scope', sorts: 'createdAt' }, {
                    schema: 'event',
                    throwOnFailure: true,
                    ...OPT_IN,
                }),
                { code: ErrorCode.KEY_NOT_ALLOWED, message: ErrorMessage.keyNotPermitted('createdAt') },
            );
        });

        it('should reject a dotted sort even with the relation included', () => {
            const items = issuesOf(() => new SimpleParser().parse(
                {
                    groups: 'scope',
                    relations: ['realm'],
                    filters: { 'realm.name': 'admin' },
                    sorts: 'realm.name',
                },
                { throwOnFailure: true, ...OPT_IN },
            ));

            expect(items).toHaveLength(1);
            expect(items[0]?.meta?.parameter).toBe(Parameter.SORTS);
        });

        it('should bind sorts to output keys in an unbound parse', () => {
            const unbound = new SimpleParser();

            expect(unbound.parse({ groups: 'scope', sorts: 'age,realm.name,-scope' }, OPT_IN).sorts)
                .toEqual(new Sorts([new Sort('scope', SortDirection.DESC)]));

            expectRejected(
                () => unbound.parse({ groups: 'scope', sorts: 'age' }, { throwOnFailure: true, ...OPT_IN }),
                { code: ErrorCode.KEY_NOT_ALLOWED, message: ErrorMessage.keyNotPermitted('age') },
            );
        });
    });

    describe('validate hooks', () => {
        type Actor = { permissions: string[] };

        const actor : Actor = { permissions: ['scope', 'count'] };

        const schema = defineSchema<Record<string, any>, Actor>({
            groups: {
                allowed: ['scope', 'name'],
                validate: (group, context) => context.permissions.includes(group.name),
            },
            aggregates: {
                functions: { count: {}, sum: { allowed: ['amount'] } },
                validate: (aggregate, context) => context.permissions.includes(aggregate.name),
            },
        });

        it('should accept the terms the hooks accept', () => {
            const query = parser.parse({ groups: 'scope', aggregates: 'count' }, {
                schema,
                context: actor,
                ...OPT_IN,
            });

            expect(query.groups.value.map((item) => item.key)).toEqual(['scope']);
            expect(query.aggregates.value.map((item) => item.key)).toEqual(['count']);
        });

        it('should reject what the hooks reject, whatever the failure policy', () => {
            const items = issuesOf(() => parser.parse({ groups: 'scope,name', aggregates: 'count,sum(amount)' }, {
                schema,
                context: actor,
                throwOnFailure: false,
                ...OPT_IN,
            }));

            expect(items).toEqual([
                expect.objectContaining({
                    code: ErrorCode.KEY_VALIDATE_REJECTED,
                    path: ['name'],
                    message: ErrorMessage.keyValidateRejected('name'),
                    meta: { parameter: Parameter.GROUPS },
                }),
                expect.objectContaining({
                    code: ErrorCode.KEY_VALIDATE_REJECTED,
                    path: ['sum'],
                    message: ErrorMessage.keyValidateRejected('sum(amount)'),
                    meta: { parameter: Parameter.AGGREGATES, key: 'sum(amount)' },
                }),
            ]);
        });

        it('should hand the hook the resolved node and the parse context', () => {
            const calls : [IGroup | IAggregate, unknown][] = [];
            const recording = defineSchema({
                groups: {
                    functions: { bucket: { allowed: ['createdAt'] } },
                    validate: (group, context) => {
                        calls.push([group, context]);
                        return true;
                    },
                },
                aggregates: {
                    functions: { count: {} },
                    validate: (aggregate, context) => {
                        calls.push([aggregate, context]);
                        return true;
                    },
                },
            });

            parser.parse({ groups: 'bucket(createdAt,day)', aggregates: 'count' }, {
                schema: recording,
                context: actor,
                ...OPT_IN,
            });

            expect(calls).toEqual([
                [
                    expect.objectContaining({
                        key: 'createdAt',
                        name: 'bucket',
                        params: ['createdAt', 'day'],
                        lowering: {
                            fn: 'bucket',
                            field: 'createdAt',
                            args: ['day'],
                        },
                    }),
                    actor,
                ],
                [
                    expect.objectContaining({
                        key: 'count',
                        name: 'count',
                        params: [],
                        lowering: {
                            fn: 'count',
                            field: undefined,
                            args: [],
                        },
                    }),
                    actor,
                ],
            ]);
        });

        it('should reject a term the hook answers with a condition', () => {
            const conditional = defineSchema({
                groups: {
                    allowed: ['scope'],
                    validate: () => eq('scope', 'auth'),
                },
            });

            expectRejected(
                () => parser.parse({ groups: 'scope' }, { schema: conditional, ...OPT_IN }),
                { code: ErrorCode.KEY_VALIDATE_REJECTED },
            );
        });

        it('should run from a standalone sub-parser', () => {
            expectRejected(
                () => new SimpleGroupsParser().parse('name', { schema: schema.groups, context: actor }),
                { code: ErrorCode.KEY_VALIDATE_REJECTED, message: ErrorMessage.keyValidateRejected('name') },
            );
        });

        it('should refuse an async hook on the sync parse path', () => {
            const deferred = defineSchema({
                groups: {
                    allowed: ['scope'],
                    validate: async () => true,
                },
            });

            expect.assertions(1);
            try {
                parser.parse({ groups: 'scope' }, { schema: deferred, ...OPT_IN });
            } catch (e) {
                expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
            }
        });

        it('should await async hooks sequentially on parseAsync', async () => {
            const order : string[] = [];
            const deferred = defineSchema<Record<string, any>, Actor>({
                groups: {
                    allowed: ['scope', 'name'],
                    validate: async (group, context) => {
                        // the first hook settles last: a parallel pass would record name first.
                        await new Promise((resolve) => { setTimeout(resolve, group.name === 'scope' ? 10 : 0); });
                        order.push(group.name);
                        return context.permissions.includes(group.name);
                    },
                },
            });

            const query = await parser.parseAsync({ groups: 'scope' }, {
                schema: deferred,
                context: actor,
                ...OPT_IN,
            });
            expect(query.groups.value.map((item) => item.key)).toEqual(['scope']);

            order.length = 0;
            await expect(parser.parseAsync({ groups: 'scope,name' }, {
                schema: deferred,
                context: actor,
                ...OPT_IN,
            })).rejects.toMatchObject({ code: ErrorCode.INPUT_REJECTED });
            expect(order).toEqual(['scope', 'name']);
        });
    });

    describe('includes', () => {
        const unbound = new SimpleParser();
        const THROW = { ...OPT_IN, throwOnFailure: true };

        it('should reject an include no filter traverses', () => {
            const items = issuesOf(() => unbound.parse({ groups: 'scope', relations: ['realm'] }, THROW));

            expect(items).toEqual([expect.objectContaining({
                code: ErrorCode.FEATURE_UNSUPPORTED,
                path: ['realm'],
                message: ErrorMessage.featureUnsupported('relations:grouped'),
                meta: { parameter: Parameter.RELATIONS },
            })]);
        });

        it('should drop an include no filter traverses under the dropping policy', async () => {
            const input = { groups: 'scope', relations: ['realm'] };

            expect(unbound.parse(input, OPT_IN).relations.value).toEqual([]);
            expect((await unbound.parseAsync(input, OPT_IN)).relations.value).toEqual([]);
        });

        it('should accept an include a filter traverses', () => {
            const query = unbound.parse({
                groups: 'scope',
                relations: ['realm'],
                filters: { 'realm.name': 'admin' },
            }, OPT_IN);

            expect(query.relations.value.map((item) => item.name)).toEqual(['realm']);
        });

        it('should count a prefix of a traversed path as traversed', () => {
            const query = unbound.parse({
                groups: 'scope',
                relations: ['items', 'items.realm'],
                filters: { 'items.realm.name': 'admin' },
            }, OPT_IN);

            expect(query.relations.value.map((item) => item.name)).toEqual(['items', 'items.realm']);

            const items = issuesOf(() => unbound.parse({
                groups: 'scope',
                relations: ['items', 'items.realm'],
                filters: { 'items.name': 'x' },
            }, THROW));

            expect(items.map((item) => item.path)).toEqual([['items', 'realm']]);
        });

        it('should count a relation the schema filters default traverses', async () => {
            const bound = defineSchema({
                relations: { allowed: ['realm'] },
                filters: { default: eq('realm.name', 'admin') },
                groups: { allowed: ['scope'] },
            });
            const input = { groups: 'scope', relations: ['realm'] };

            expect(parser.parse(input, { schema: bound, ...OPT_IN }).relations.value).toHaveLength(1);
            expect((await parser.parseAsync(input, { schema: bound, ...OPT_IN })).relations.value).toHaveLength(1);
        });

        it('should reject asynchronously as well', async () => {
            await expect(unbound.parseAsync({ groups: 'scope', relations: ['realm'] }, THROW))
                .rejects.toMatchObject({ code: ErrorCode.INPUT_REJECTED });
        });

        it('should leave a record read with includes untouched', () => {
            expect(unbound.parse({ relations: ['realm'] }, OPT_IN).relations.value).toHaveLength(1);
        });
    });

    describe('parseAsync', () => {
        it('should parse the same query', async () => {
            const input = {
                groups: 'period(day),scope',
                aggregates: 'count,total(amount)',
                sorts: '-count',
            };
            const options = { schema: 'event', ...OPT_IN };

            await expect(parser.parseAsync(input, options)).resolves.toEqual(parser.parse(input, options));
        });

        it('should raise the same rejection', async () => {
            await expect(parser.parseAsync({ groups: 'email' }, { schema: 'event', ...OPT_IN }))
                .rejects.toBeInstanceOf(ParseError);
        });
    });
});
