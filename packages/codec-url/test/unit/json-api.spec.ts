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
    defineSchema,
} from '@rapiq/core';
import type { Issue, ParseError  } from '@rapiq/core';
import { URLParameter, createURLCodec, toJsonApiErrors } from '../../src';

const issue = (overrides: Partial<Issue> = {}) : Issue => ({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FILTERS,
    path: ['items', 'secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
    severity: 'error',
    ...overrides,
});

describe('src/json-api.ts', () => {
    it('should render an issue against its wire parameter name', () => {
        expect(toJsonApiErrors([issue()])).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            detail: ErrorMessage.keyNotPermitted('secret'),
            source: { parameter: URLParameter.FILTERS },
            meta: { severity: 'error', path: 'items.secret' },
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

        expect(toJsonApiErrors(parameters.map((parameter) => issue({ parameter })))
            .map((error) => error.source.parameter)).toEqual([
            URLParameter.FIELDS,
            URLParameter.FILTERS,
            URLParameter.PAGINATION,
            URLParameter.RELATIONS,
            URLParameter.SORT,
            URLParameter.SORT,
        ]);
    });

    it('should skip warnings unless asked', () => {
        const input = [issue(), issue({ severity: 'warning' })];

        expect(toJsonApiErrors(input)).toHaveLength(1);
        expect(toJsonApiErrors(input, { warnings: true })).toHaveLength(2);
    });

    it('should stamp a status when given one', () => {
        expect(toJsonApiErrors([issue()], { status: '400' })[0]?.status).toBe('400');
    });

    it('should omit the path of a parameter-level issue', () => {
        expect(toJsonApiErrors([issue({ path: [] })])[0]?.meta).toEqual({ severity: 'error' });
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

        expect(toJsonApiErrors(error?.issues ?? [], { status: '400' })).toEqual([{
            status: '400',
            code: ErrorCode.KEY_NOT_ALLOWED,
            detail: ErrorMessage.keyNotPermitted('secret'),
            source: { parameter: URLParameter.FILTERS },
            meta: { severity: 'error', path: 'secret' },
        }]);
    });
});
