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
    SchemaRegistry,
    buildIssue,
    defineSchema,
} from '@rapiq/core';
import type { IssueInput, ParseError } from '@rapiq/core';
import { defineIssueGroup } from '@ebec/core';
import type { IssueItem } from '@ebec/core';
import { URLParameter, createURLCodec, formatErrors } from '../../src';

const issue = (overrides: Partial<IssueInput> = {}) : IssueItem => buildIssue({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FILTERS,
    path: ['items', 'secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
    ...overrides,
});

describe('src/error/*.ts', () => {
    it('should render an issue against its wire parameter name', () => {
        expect(formatErrors([issue()])).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            detail: ErrorMessage.keyNotPermitted('secret'),
            source: { parameter: URLParameter.FILTERS },
            meta: { path: 'items.secret' },
        }]);
    });

    it('should map every canonical parameter', () => {
        const parameters = [
            Parameter.FIELDS,
            Parameter.FILTERS,
            Parameter.PAGINATION,
            Parameter.RELATIONS,
            Parameter.SORTS,
            Parameter.SORT,
        ];

        expect(formatErrors(parameters.map((parameter) => issue({ parameter })))
            .map((error) => error.source?.parameter)).toEqual([
            URLParameter.FIELDS,
            URLParameter.FILTERS,
            URLParameter.PAGINATION,
            URLParameter.RELATIONS,
            URLParameter.SORT,
            URLParameter.SORT,
        ]);
    });

    it('should render the leaves of a nested trace, not the groups', () => {
        const leaf = issue({ path: ['items', 'title'] });

        // a group says nothing the leaves below it do not, and every leaf
        // already knows its absolute position
        expect(formatErrors([defineIssueGroup({
            parameter: Parameter.FILTERS,
            path: ['items'],
            message: 'The relation items is not permitted.',
            issues: [leaf],
        })])).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            detail: ErrorMessage.keyNotPermitted('secret'),
            source: { parameter: URLParameter.FILTERS },
            meta: { path: 'items.title' },
        }]);
    });

    it('should stamp a status when given one', () => {
        expect(formatErrors([issue()], { status: '400' })[0]?.status).toBe('400');
    });

    it('should omit the path of a parameter-level issue', () => {
        expect(formatErrors([issue({ path: [] })])[0]?.meta).toBeUndefined();
    });

    it('should render what a decode raised', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'user',
            throwOnFailure: true,
            filters: { allowed: ['id'] },
        }));

        const codec = createURLCodec(registry);

        let error : ParseError | undefined;
        try {
            codec.decode('filter[secret]=x', { schema: 'user' });
        } catch (e) {
            error = e as ParseError;
        }

        expect(formatErrors(error?.issues ?? [], { status: '400' })).toEqual([{
            status: '400',
            code: ErrorCode.KEY_NOT_ALLOWED,
            detail: ErrorMessage.keyNotPermitted('secret'),
            source: { parameter: URLParameter.FILTERS },
            meta: { path: 'secret' },
        }]);
    });
});
