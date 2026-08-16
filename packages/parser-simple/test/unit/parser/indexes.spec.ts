/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    Parameter,
    ParseError,
    SchemaRegistry,
    SortDirection,
    and,
    defineSchema,
    eq,
    extractIssueParameter,
} from '@rapiq/core';
import { SimpleParser } from '../../../src';
import { expectRejected } from '../../data';

type Item = {
    id: string,
    user_id: string,
    name: string,
};

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    email: string,
    flag: boolean,
    items: Item[],
};

const buildRegistry = (extra: {
    throwOnFailure?: boolean,
    validate?: boolean,
    validateFailure?: Error,
} = {}) => {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Row>({
        name: 'row',
        throwOnFailure: extra.throwOnFailure,
        indexes: [['realm_id', 'created_at'], ['email']],
        filters: {
            indexed: true,
            default: eq('flag', true),
            ...(extra.validate || extra.validateFailure ? {
                validate: (input) => {
                    if (extra.validateFailure) {
                        throw extra.validateFailure;
                    }

                    return input.field === 'flag' ?
                        and(input, eq('realm_id', 'ctx-realm')) :
                        input;
                },
            } : {}),
        },
        sort: {
            indexed: true,
            allowed: ['realm_id', 'created_at', 'email'],
            default: { created_at: 'DESC' },
        },
        schemaMapping: { items: 'item' },
    }));
    registry.add(defineSchema<Item>({
        name: 'item',
        indexes: [['user_id']],
        sort: { default: { name: 'ASC' } },
    }));

    return registry;
};

describe('indexed schemas', () => {
    describe('filters', () => {
        it('should keep an anchored request', () => {
            const parser = new SimpleParser(buildRegistry());
            const output = parser.parseFilters({ realm_id: 'x', flag: 'true' }, { schema: 'row' });

            expect(output.value.map((item) => (item as { field: string }).field).sort())
                .toEqual(['flag', 'realm_id']);
        });

        it('should drop an unanchored request to the default', () => {
            const parser = new SimpleParser(buildRegistry());
            const output = parser.parseFilters({ created_at: 'x' }, { schema: 'row' });

            expect(output.value).toEqual([eq('flag', true)]);
        });

        it('should throw typed under throwOnFailure', () => {
            const parser = new SimpleParser(buildRegistry({ throwOnFailure: true }));

            expectRejected(
                () => parser.parseFilters({ created_at: 'x' }, { schema: 'row' }),
                { code: ErrorCode.KEY_COMBINATION_NOT_INDEXED },
            );
        });

        it('should accept a validate residual as anchor', () => {
            const parser = new SimpleParser(buildRegistry({ validate: true }));
            const output = parser.parseFilters({ flag: 'true' }, { schema: 'row' });

            // the hook conjoined eq(realm_id): the executed tree is
            // anchored, and it is the validated tree that survives,
            // not the default fallback.
            expect(output.value).toEqual([and(eq('flag', true), eq('realm_id', 'ctx-realm'))]);
        });

        it('should anchor through a relation index', () => {
            const parser = new SimpleParser(buildRegistry());
            const output = parser.parseFilters({ 'items.user_id': 'x' }, { schema: 'row' });

            expect(output.value).toHaveLength(1);
        });
    });

    describe('sort', () => {
        it('should keep an index prefix, directions ignored', () => {
            const parser = new SimpleParser(buildRegistry());
            const output = parser.parseSort('-realm_id,created_at', { schema: 'row' });

            expect(output.value.map((sort) => sort.name)).toEqual(['realm_id', 'created_at']);
        });

        it('should drop a non-prefix to the default', () => {
            const parser = new SimpleParser(buildRegistry());
            const output = parser.parseSort('created_at', { schema: 'row' });

            expect(output.value.map((sort) => sort.name)).toEqual(['created_at']);
            expect(output.value.map((sort) => sort.operator)).toEqual([SortDirection.DESC]);
        });

        it('should exempt a relation-scope default from the check', () => {
            const parser = new SimpleParser(buildRegistry());
            // 'items.bogus' drops against the item schema, whose sort
            // default then joins the output. The server-authored child
            // entry must not reject the valid client prefix.
            const output = parser.parseSort(['-realm_id', 'items.bogus'], { schema: 'row' });

            expect(output.value.map((sort) => sort.name)).toEqual(['realm_id', 'items.name']);
        });
    });

    describe('composed parse', () => {
        it('should silently fall back for both parameters in sync and async parses', async () => {
            const parser = new SimpleParser(buildRegistry());
            const input = {
                filters: { created_at: 'x' },
                sorts: 'created_at',
            };

            for (const query of [
                parser.parse(input, { schema: 'row' }),
                await parser.parseAsync(input, { schema: 'row' }),
            ]) {
                expect(query.filters.value).toEqual([eq('flag', true)]);
                expect(query.sorts.value.map((sort) => [sort.name, sort.operator]))
                    .toEqual([['created_at', SortDirection.DESC]]);
            }
        });

        // A1: the call-time throwOnFailure override reaches applyIndexPolicies,
        // not only the schema-level setting (buildRegistry() below defaults it
        // to undefined/false).
        it('should let a parse-option throwOnFailure override throw on the composed query, without the schema opting in', () => {
            const parser = new SimpleParser(buildRegistry());

            expectRejected(
                () => parser.parse({ filters: { created_at: 'x' } }, { schema: 'row', throwOnFailure: true }),
                { code: ErrorCode.KEY_COMBINATION_NOT_INDEXED },
            );
        });

        it('should collect both indexed-parameter failures in sync and async parses', async () => {
            const parser = new SimpleParser(buildRegistry());
            const input = {
                filters: { created_at: 'x' },
                sorts: 'created_at',
            };

            for (const run of [
                () => parser.parse(input, { schema: 'row', throwOnFailure: true }),
                () => parser.parseAsync(input, { schema: 'row', throwOnFailure: true }),
            ]) {
                try {
                    await run();
                    expect.fail('expected a ParseError');
                } catch (e) {
                    expect(e).toBeInstanceOf(ParseError);
                    const error = e as ParseError;
                    expect(error.issues
                        .filter((issue) => issue.code === ErrorCode.KEY_COMBINATION_NOT_INDEXED)
                        .map((issue) => extractIssueParameter(issue)))
                        .toEqual([Parameter.FILTERS, Parameter.SORTS]);
                }
            }
        });

        it('should propagate non-parse failures unchanged in sync and async parses', async () => {
            const failure = new Error('validate failed');
            const parser = new SimpleParser(buildRegistry({ validateFailure: failure }));
            const input = { filters: { created_at: 'x' } };

            for (const run of [
                () => parser.parse(input, { schema: 'row' }),
                () => parser.parseAsync(input, { schema: 'row' }),
            ]) {
                try {
                    await run();
                    expect.fail('expected the validate failure');
                } catch (e) {
                    expect(e).toBe(failure);
                }
            }
        });
    });
});
