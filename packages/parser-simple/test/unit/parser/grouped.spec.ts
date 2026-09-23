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
} from '@rapiq/core';
import { SimpleParser } from '../../../src';
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

            expect(query.groups.value.map((item) => item.key)).toEqual(['bucket', 'scope']);
            expect(query.aggregates.value.map((item) => item.key)).toEqual(['count', 'sum_amount']);
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
                    groups: 'scope',
                    aggregates: 'count(couponId),total(fee)',
                    sorts: '-count_couponId,scope,total_fee',
                },
                { schema: 'event', ...OPT_IN },
            );

            expect(query.sorts).toEqual(new Sorts([
                new Sort('count_couponId', SortDirection.DESC),
                new Sort('scope', SortDirection.ASC),
                new Sort('total_fee', SortDirection.ASC),
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
