/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    ErrorMessage,
    Parameter,
    defineSchema,
    resolveCallTerm,
} from '../../../src';
import type { CallResolution, CallTerm } from '../../../src';
import type { Order } from '../../data';
import { orderSchema } from '../../data/schema';

type Case = {
    title: string,
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    term: CallTerm,
    bound: boolean,
    expected: CallResolution,
};

const ok = (fn: string | undefined, field: string | undefined, args: string[] = []) : CallResolution => ({
    success: true,
    lowering: {
        fn,
        field,
        args,
    },
});

const no = (code: `${ErrorCode}`, message: string) : CallResolution => ({
    success: false,
    code,
    message,
});

const G = Parameter.GROUPS;
const A = Parameter.AGGREGATES;

const cases : Case[] = [
    // step 1 and 2: identifiers
    {
        title: 'a dotted group column',
        parameter: G,
        bound: true,
        term: { name: 'realm.name', params: [] },
        expected: no(ErrorCode.KEY_PATH_NOT_ALLOWED, ErrorMessage.keyPathNotPermitted('realm.name')),
    },
    {
        title: 'a dotted argument',
        parameter: G,
        bound: true,
        term: { name: 'bucket', params: ['created.at', 'day'] },
        expected: no(ErrorCode.KEY_PATH_NOT_ALLOWED, ErrorMessage.keyPathNotPermitted('created.at')),
    },
    {
        title: 'a dot outranks an invalid callee',
        parameter: G,
        bound: false,
        term: { name: '1x', params: ['a.b'] },
        expected: no(ErrorCode.KEY_PATH_NOT_ALLOWED, ErrorMessage.keyPathNotPermitted('a.b')),
    },
    {
        title: 'an invalid identifier',
        parameter: A,
        bound: true,
        term: { name: '1st', params: [] },
        expected: no(ErrorCode.KEY_INVALID, ErrorMessage.keyInvalid('1st')),
    },
    // step 3: bound
    {
        title: 'a declared column',
        parameter: G,
        bound: true,
        term: { name: 'status', params: [] },
        expected: ok(undefined, 'status'),
    },
    {
        title: 'the built-in bucket',
        parameter: G,
        bound: true,
        term: { name: 'bucket', params: ['createdAt', 'day'] },
        expected: ok('bucket', 'createdAt', ['day']),
    },
    {
        title: 'a named bucket',
        parameter: G,
        bound: true,
        term: { name: 'period', params: ['hour'] },
        expected: ok('bucket', 'createdAt', ['hour']),
    },
    {
        title: 'an undeclared column',
        parameter: G,
        bound: true,
        term: { name: 'id', params: [] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('id')),
    },
    {
        title: 'a column called like a function',
        parameter: G,
        bound: true,
        term: { name: 'status', params: ['x'] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('status')),
    },
    {
        title: 'a reserved prototype key',
        parameter: G,
        bound: true,
        term: { name: 'constructor', params: [] },
        expected: no(ErrorCode.KEY_INVALID, ErrorMessage.keyInvalid('constructor')),
    },
    {
        title: 'an undeclared primitive',
        parameter: A,
        bound: true,
        term: { name: 'sum', params: ['amount'] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('sum')),
    },
    {
        title: 'a bare column as an aggregate',
        parameter: A,
        bound: true,
        term: { name: 'status', params: [] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('status')),
    },
    // step 4: arity
    {
        title: 'a named bucket without its open slot',
        parameter: G,
        bound: true,
        term: { name: 'period', params: [] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('period')),
    },
    {
        title: 'a named bucket with one argument too many',
        parameter: G,
        bound: true,
        term: { name: 'period', params: ['day', 'hour'] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('period')),
    },
    {
        title: 'an argument for a fixed slot',
        parameter: A,
        bound: true,
        term: { name: 'revenue', params: ['amount'] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('revenue')),
    },
    // step 5 and 6: slot values
    {
        title: 'a bucket over an undeclared column',
        parameter: G,
        bound: true,
        term: { name: 'bucket', params: ['amount', 'day'] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('amount')),
    },
    {
        title: 'a unit the named bucket does not open',
        parameter: G,
        bound: true,
        term: { name: 'period', params: ['month'] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('period')),
    },
    {
        title: 'count over an undeclared column',
        parameter: A,
        bound: true,
        term: { name: 'count', params: ['amount'] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('amount')),
    },
    {
        title: 'a named sum over an undeclared column',
        parameter: A,
        bound: true,
        term: { name: 'total', params: ['couponId'] },
        expected: no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('couponId')),
    },
    // step 7: success
    {
        title: 'count()',
        parameter: A,
        bound: true,
        term: { name: 'count', params: [] },
        expected: ok('count', undefined),
    },
    {
        title: 'count(column)',
        parameter: A,
        bound: true,
        term: { name: 'count', params: ['couponId'] },
        expected: ok('count', 'couponId'),
    },
    {
        title: 'a named sum with an open field',
        parameter: A,
        bound: true,
        term: { name: 'total', params: ['fee'] },
        expected: ok('sum', 'fee'),
    },
    {
        title: 'a named sum with a fixed field',
        parameter: A,
        bound: true,
        term: { name: 'revenue', params: [] },
        expected: ok('sum', 'amount'),
    },
    // unbound
    {
        title: 'an unbound bucket',
        parameter: G,
        bound: false,
        term: { name: 'bucket', params: ['createdAt', 'day'] },
        expected: ok('bucket', 'createdAt', ['day']),
    },
    {
        title: 'an unbound bucket with an unknown unit',
        parameter: G,
        bound: false,
        term: { name: 'bucket', params: ['createdAt', 'week'] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('bucket')),
    },
    {
        title: 'an unbound bucket without a unit',
        parameter: G,
        bound: false,
        term: { name: 'bucket', params: ['createdAt'] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('bucket')),
    },
    {
        title: 'an unbound bare column',
        parameter: G,
        bound: false,
        term: { name: 'scope', params: [] },
        expected: ok(undefined, 'scope'),
    },
    {
        title: 'an unbound named group',
        parameter: G,
        bound: false,
        term: { name: 'period', params: ['day'] },
        expected: no(ErrorCode.OPERATOR_UNSUPPORTED, ErrorMessage.operatorUnsupported('period')),
    },
    {
        title: 'an unbound count()',
        parameter: A,
        bound: false,
        term: { name: 'count', params: [] },
        expected: ok('count', undefined),
    },
    {
        title: 'an unbound sum over any column',
        parameter: A,
        bound: false,
        term: { name: 'sum', params: ['amount'] },
        expected: ok('sum', 'amount'),
    },
    {
        title: 'an unbound sum without a column',
        parameter: A,
        bound: false,
        term: { name: 'sum', params: [] },
        expected: no(ErrorCode.KEY_VALUE_INVALID, ErrorMessage.callArgumentsInvalid('sum')),
    },
    {
        title: 'an unbound named aggregate',
        parameter: A,
        bound: false,
        term: { name: 'total', params: ['amount'] },
        expected: no(ErrorCode.OPERATOR_UNSUPPORTED, ErrorMessage.operatorUnsupported('total')),
    },
    {
        title: 'an unbound bare aggregate',
        parameter: A,
        bound: false,
        term: { name: 'scope', params: [] },
        expected: no(ErrorCode.OPERATOR_UNSUPPORTED, ErrorMessage.operatorUnsupported('scope')),
    },
    {
        title: 'an unbound prototype key',
        parameter: A,
        bound: false,
        term: { name: 'toString', params: [] },
        expected: no(ErrorCode.OPERATOR_UNSUPPORTED, ErrorMessage.operatorUnsupported('toString')),
    },
];

describe('src/schema/parameter/call/module.ts', () => {
    it.each(cases)('should resolve $title', ({
        parameter,
        term,
        bound,
        expected,
    }) => {
        const schema = parameter === Parameter.GROUPS ? orderSchema.groups : orderSchema.aggregates;

        expect(resolveCallTerm(parameter, term, bound ? schema : undefined)).toEqual(expected);
    });

    it('should permit nothing on a bound schema without a declaration', () => {
        const schema = defineSchema<Order>({});

        expect(resolveCallTerm(Parameter.GROUPS, { name: 'status', params: [] }, schema.groups))
            .toEqual(no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('status')));
        expect(resolveCallTerm(Parameter.AGGREGATES, { name: 'count', params: [] }, schema.aggregates))
            .toEqual(no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('count')));
    });

    it.each(['__proto__', 'constructor', 'prototype'])('should refuse the reserved identifier %s', (name) => {
        const expected = no(ErrorCode.KEY_INVALID, ErrorMessage.keyInvalid(name));

        expect(resolveCallTerm(Parameter.GROUPS, { name, params: [] })).toEqual(expected);
        expect(resolveCallTerm(Parameter.GROUPS, { name, params: [] }, orderSchema.groups)).toEqual(expected);
        expect(resolveCallTerm(Parameter.AGGREGATES, { name: 'sum', params: [name] })).toEqual(expected);
        expect(resolveCallTerm(Parameter.AGGREGATES, { name: 'sum', params: [name] }, orderSchema.aggregates))
            .toEqual(expected);
    });

    it('should not read columns from a schema of the other parameter', () => {
        expect(resolveCallTerm(Parameter.GROUPS, { name: 'status', params: [] }, orderSchema.aggregates))
            .toEqual(no(ErrorCode.KEY_NOT_ALLOWED, ErrorMessage.keyNotPermitted('status')));
    });
});
