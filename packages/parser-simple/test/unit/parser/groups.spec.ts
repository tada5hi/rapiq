/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { flattenIssueItems } from '@ebec/core';
import {
    ErrorCode,
    ErrorMessage,
    Group,
    Groups,
    GroupsParseError,
    Parameter,
} from '@rapiq/core';
import { SimpleGroupsParser } from '../../../src';
import { registry } from '../../data';

function errorOf(run: () => unknown) : GroupsParseError | undefined {
    try {
        run();
    } catch (e) {
        return e as GroupsParseError;
    }

    return undefined;
}

describe('src/parameter/groups', () => {
    const parser = new SimpleGroupsParser(registry);

    it('should resolve built-in calls, named calls and bare columns', () => {
        expect(parser.parse('bucket(createdAt,day),period(hour),scope', { schema: 'event' })).toEqual(new Groups([
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
                name: 'period',
                params: ['hour'],
                lowering: {
                    fn: 'bucket',
                    field: 'createdAt',
                    args: ['hour'],
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
        ]));
    });

    it('should accept the groups sub-schema itself', () => {
        const schema = registry.getOrFail('event').groups;

        expect(parser.parse('name', { schema }).value.map((group) => group.key)).toEqual(['name']);
    });

    it('should resolve primitives and bare columns without a schema', () => {
        expect(parser.parse('bucket(createdAt,month),scope')).toEqual(new Groups([
            new Group({
                name: 'bucket',
                params: ['createdAt', 'month'],
                lowering: {
                    fn: 'bucket',
                    field: 'createdAt',
                    args: ['month'],
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
        ]));
    });

    it('should raise every rejected term as its own error class', () => {
        const error = errorOf(() => parser.parse('email,bucket(createdAt,week),scope', { schema: 'event' }));

        expect(error).toBeInstanceOf(GroupsParseError);
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([
            {
                type: 'item',
                code: ErrorCode.KEY_NOT_ALLOWED,
                path: ['email'],
                message: ErrorMessage.keyNotPermitted('email'),
                meta: { parameter: Parameter.GROUPS },
            },
            {
                type: 'item',
                code: ErrorCode.KEY_VALUE_INVALID,
                path: ['bucket'],
                message: ErrorMessage.callArgumentsInvalid('bucket'),
                meta: { parameter: Parameter.GROUPS, key: 'bucket(createdAt,week)' },
            },
        ]);
    });

    it('should reject a key requested twice', () => {
        const error = errorOf(() => parser.parse('bucket(createdAt,day),bucket(createdAt,hour)', { schema: 'event' }));

        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([expect.objectContaining({
            code: ErrorCode.KEY_AMBIGUOUS,
            path: ['bucket'],
            message: ErrorMessage.outputKeyDuplicate('bucket'),
        })]);
    });

    it('should turn a grammar violation into an issue of its own class', () => {
        const error = errorOf(() => parser.parse('scope,,name', { schema: 'event' }));

        expect(error).toBeInstanceOf(GroupsParseError);
        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([
            expect.objectContaining({ code: ErrorCode.SYNTAX_INVALID }),
        ]);
    });

    it('should reject every term under a bound schema without a groups block', () => {
        const error = errorOf(() => parser.parse('name', { schema: 'user' }));

        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([expect.objectContaining({
            code: ErrorCode.KEY_NOT_ALLOWED,
            message: ErrorMessage.keyNotPermitted('name'),
        })]);
    });

    it('should parse the same way asynchronously', async () => {
        await expect(parser.parseAsync('scope', { schema: 'event' })).resolves
            .toEqual(parser.parse('scope', { schema: 'event' }));
        await expect(parser.parseAsync('email', { schema: 'event' })).rejects
            .toBeInstanceOf(GroupsParseError);
    });
});
