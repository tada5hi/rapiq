/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    ErrorMessage,
    FieldsParseError,
    MAX_ISSUES,
    Parameter,
    ParseError,
    SchemaRegistry,
    defineSchema,
    eq,
    extractIssueParameter,
    preserve,
} from '@rapiq/core';
import type { Issue } from 'blemish';
import { SimpleFieldsParser, SimplePaginationParser, SimpleParser } from '../../../src';
import { expectRejected } from '../../data';
import type { User } from '../../data';

const buildRegistry = (throwOnFailure?: boolean) => {
    const registry = new SchemaRegistry();

    registry.add(defineSchema<User>({
        name: 'user',
        throwOnFailure,
        fields: { allowed: ['id', 'name', 'email'] },
        filters: { allowed: ['id', 'name'] },
        relations: { allowed: ['items'] },
        pagination: { maxLimit: 50 },
        sorts: { allowed: ['id', 'name'], default: { name: 'DESC' } },
        schemaMapping: { items: 'item' },
    }));

    registry.add(defineSchema({
        name: 'item',
        throwOnFailure,
        fields: { allowed: ['id'] },
        filters: { allowed: ['id'] },
        sorts: { allowed: ['id'] },
    }));

    return registry;
};

/**
 * The trace has exactly one channel: the error a parse raises. A parse that
 * raises nothing discards it.
 */
const trace = (run: () => unknown) : { error?: ParseError, issues: readonly Issue[] } => {
    try {
        run();
    } catch (e) {
        const error = e as ParseError;

        return { error, issues: error.issues ?? [] };
    }

    return { issues: [] };
};

const findIssue = (
    issues: readonly Issue[],
    parameter: `${Parameter}`,
    code?: `${ErrorCode}`,
) => issues.find((issue) => extractIssueParameter(issue) === parameter &&
    (typeof code === 'undefined' || issue.code === code));

describe('src/parser — issue traces', () => {
    describe('the raise condition', () => {
        it('should raise nothing while the policy drops', () => {
            const parser = new SimpleParser(buildRegistry());

            const query = parser.parse({ fields: ['id', 'secret'] }, { schema: 'user' });

            expect(query.fields.value.map((field) => field.name)).toEqual(['id']);
        });

        it('should raise one general failure once the policy throws', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({ fields: ['id', 'secret'] }, { schema: 'user' }));

            // one error for the request, never the first violation's own class:
            // a parse can reject input in several parameters at once, and an
            // error naming one of them describes a subset of what went wrong
            expect(error).toBeInstanceOf(ParseError);
            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(error?.constructor).toBe(ParseError);

            expect(issues).toHaveLength(1);
            expect(issues[0]).toEqual({
                type: 'item',
                code: ErrorCode.KEY_NOT_ALLOWED,
                path: ['secret'],
                message: ErrorMessage.keyNotPermitted('secret'),
                // rapiq's two meta keys: neither is reconstructible from the
                // path, which is what earns them a place there
                meta: { parameter: Parameter.FIELDS, key: 'secret' },
            });
        });
    });

    describe('what a failure is raised as', () => {
        it('should name the parameter when a single-parameter parse fails', () => {
            const parser = new SimpleFieldsParser(buildRegistry(true));

            const { error } = trace(() => parser.parse(['secret'], { schema: 'user' }));

            // the caller asked about one parameter, so saying which one is the
            // whole truth — and it is the class that parameter always threw
            expect(error).toBeInstanceOf(FieldsParseError);
            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        });

        it('should name it for a parameter driver too', () => {
            const parser = new SimpleFieldsParser(buildRegistry(true));

            const { error } = trace(() => parser.parseParameter(['secret'], { schema: 'user' }, []));

            expect(error).toBeInstanceOf(FieldsParseError);
        });

        it('should name none when a query parse fails', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({
                fields: ['nope1'],
                filters: { nope2: 'x' },
            }, { schema: 'user' }));

            // two parameters rejected input: naming one would describe a
            // subset, so the sub-parser failures are merged into a general one
            expect(error?.constructor).toBe(ParseError);
            expect(error).not.toBeInstanceOf(FieldsParseError);
            expect(issues.map((issue) => extractIssueParameter(issue))).toEqual([
                Parameter.FIELDS,
                Parameter.FILTERS,
            ]);
        });
    });

    describe('aggregation', () => {
        it('should report every parameter rather than only the first', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({
                fields: ['nope1'],
                filters: { nope2: 'x' },
                sorts: ['nope3'],
                relations: ['nope4'],
            }, { schema: 'user' }));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(issues.length).toBeGreaterThanOrEqual(4);

            expect(findIssue(issues, Parameter.FIELDS)).toBeDefined();
            expect(findIssue(issues, Parameter.FILTERS)).toBeDefined();
            expect(findIssue(issues, Parameter.SORTS)).toBeDefined();
            expect(findIssue(issues, Parameter.RELATIONS)).toBeDefined();
        });

        it('should aggregate the keys of one parameter', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ fields: ['a', 'b', 'c'] }, { schema: 'user' }));

            expect(issues.map((issue) => issue.path)).toEqual([['a'], ['b'], ['c']]);
        });

        it('should keep a parameter abort from hiding the others', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({
                filters: 'not-an-object',
                sorts: ['nope'],
            }, { schema: 'user' }));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(findIssue(issues, Parameter.FILTERS, ErrorCode.INPUT_INVALID)).toBeDefined();
            expect(findIssue(issues, Parameter.SORTS)).toBeDefined();
        });

        it('should report the raw client key of a rejected relation path', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ filters: { 'items.secret': 'x' } }, { schema: 'user' }));

            const issue = findIssue(issues, Parameter.FILTERS);
            // the canonical position is complete; `key` is the raw spelling
            // at the position that failed, which is what alias mapping makes
            // worth keeping
            expect(issue?.path).toEqual(['items', 'secret']);
            expect(issue?.meta?.key).toBe('secret');
        });

        it('should cap a hostile trace', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const fields : string[] = [];
            for (let i = 0; i < MAX_ISSUES + 50; i++) {
                fields.push(`nope${i}`);
            }

            const { issues } = trace(() => parser.parse({ fields }, { schema: 'user' }));

            expect(issues).toHaveLength(MAX_ISSUES);
        });
    });

    describe('what rides along', () => {
        it('should carry a clamped pagination limit', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({ pagination: { limit: 500 } }, { schema: 'user' }));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(findIssue(issues, Parameter.PAGINATION)).toEqual({
                type: 'item',
                code: ErrorCode.LIMIT_EXCEEDED,
                path: ['limit'],
                received: 500,
                message: ErrorMessage.limitExceeded(50),
                meta: { parameter: Parameter.PAGINATION },
            });
        });

        it('should carry an unusable pagination value', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ pagination: { offset: 'abc' } }, { schema: 'user' }));

            const issue = findIssue(issues, Parameter.PAGINATION, ErrorCode.KEY_VALUE_INVALID);
            expect(issue?.path).toEqual(['offset']);
            expect(issue?.received).toBe('abc');
        });

        it('should report the rejection a substitution followed, and nothing else', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ sorts: ['nope'] }, { schema: 'user' }));

            // every issue is a failure: the rejected key is the trace, and the
            // schema default that replaced it is ordinary operation
            expect(issues).toHaveLength(1);
            expect(findIssue(issues, Parameter.SORTS, ErrorCode.KEY_NOT_ALLOWED)?.path)
                .toEqual(['nope']);
        });

        it('should carry an input of the wrong shape', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ pagination: 'nope' }, { schema: 'user' }));

            expect(findIssue(issues, Parameter.PAGINATION, ErrorCode.INPUT_INVALID)).toBeDefined();
        });
    });

    describe('ordering', () => {
        it('should raise the relation rejection, not the pruning conflict it causes', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                throwOnFailure: true,
                filters: { allowed: ['id'], default: preserve(eq('items.id', '1')) },
                relations: { allowed: ['items'], validate: () => false },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({ name: 'item', filters: { allowed: ['id'] } }));

            const parser = new SimpleParser(registry);

            // pruning a preserved condition off a rejected relation is a
            // SchemaError, but it is a CONSEQUENCE of the rejection: what
            // reaches the client is the rejection that caused it
            const { error, issues } = trace(() => parser.parse({ relations: ['items'] }, { schema: 'user' }));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(issues).toHaveLength(1);
            expect(issues[0]?.code).toBe(ErrorCode.KEY_VALIDATE_REJECTED);
        });

        it('should let an earlier rejection win over a later abort', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({
                fields: ['nope'],
                filters: 'not-an-object',
            }, { schema: 'user' }));

            // the abort is recorded behind the rejection that preceded it,
            // and neither of them decides what the parse raises
            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(issues[0]?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
            expect(issues.length).toBeGreaterThan(1);
        });
    });

    describe('parameter drivers', () => {
        it('should raise a violation it recorded when driven directly', () => {
            const parser = new SimpleFieldsParser(buildRegistry(true));

            // parseParameter is the query orchestrator's driver, but nothing
            // stops a caller from using it: whoever starts a trace raises it,
            // so a rejection never degrades into a silent drop
            expect(() => parser.parseParameter(['nope'], { schema: 'user' }, []))
                .toThrow(ParseError);
        });

        it('should carry the trace on an abort it was driven through', () => {
            const parser = new SimpleFieldsParser(buildRegistry());

            // the driver method has the same obligation as the entry point:
            // a structural abort ends the parameter by throwing, so it has to
            // be recorded on the way out or the trace comes back empty
            const { error, issues } = trace(() => parser.parseParameter(['__proto__'], { schema: 'user' }, []));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(issues).toHaveLength(1);
            expect(issues[0]?.code).toBe(ErrorCode.INPUT_INVALID);
        });

        it('should reject rather than throw from the async driver', async () => {
            const parser = new SimplePaginationParser(buildRegistry(true));

            // the body raises synchronously, so a driver that only wraps its
            // result would throw before the promise exists and a caller's
            // `.catch()` would never see it
            await expect(parser.parseParameterAsync({ limit: 500 }, { schema: 'user' }, []))
                .rejects.toThrow(ParseError);
        });

        it('should carry the trace on every standalone abort', () => {
            const registry = buildRegistry();

            // a structural abort ends its parameter by throwing rather than
            // by dropping a key, so it has to be recorded on the way out
            const cases : (() => unknown)[] = [
                () => new SimpleFieldsParser(registry).parse(['__proto__'], { schema: 'user' }),
                () => new SimpleParser(registry).parseFilters(JSON.parse('{"__proto__":{"x":1}}'), { schema: 'user' }),
                () => new SimpleParser(registry)
                    .parsePagination('nope', { schema: 'user', throwOnFailure: true }),
            ];

            for (const run of cases) {
                const { error, issues } = trace(run);

                expect(error).toBeInstanceOf(ParseError);
                expect(issues.length).toBeGreaterThan(0);
            }
        });
    });

    describe('validate hooks', () => {
        it('should report a rejected key', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                throwOnFailure: true,
                fields: { allowed: ['id', 'name'], validate: (key) => key !== 'name' },
            }));

            const parser = new SimpleParser(registry);
            const { issues } = trace(() => parser.parse({ fields: ['id', 'name'] }, { schema: 'user' }));

            expect(findIssue(issues, Parameter.FIELDS, ErrorCode.KEY_VALIDATE_REJECTED)?.path).toEqual(['name']);
        });

        it('should raise a rejected filter leaf under a throwing schema', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                throwOnFailure: true,
                filters: {
                    allowed: ['id', 'name'],
                    validate: (leaf) => (leaf.field === 'name' ? undefined : leaf),
                },
            }));

            const parser = new SimpleParser(registry);

            // symmetric with the fields/sorts/relations key validators, which
            // have raised KEY_VALIDATE_REJECTED all along
            expectRejected(
                () => parser.parse({ filters: { name: 'x' } }, { schema: 'user' }),
                { message: ErrorMessage.keyValidateRejected('name') },
            );
        });

        it('should honor a call-time policy override on a rejected filter leaf', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                filters: {
                    allowed: ['id', 'name'],
                    validate: (leaf) => (leaf.field === 'name' ? undefined : leaf),
                },
            }));

            const parser = new SimpleParser(registry);

            // the leaf validator is the one rejection a call-time override
            // must govern like any other
            expectRejected(
                () => parser.parse({ filters: { name: 'x' } }, { schema: 'user', throwOnFailure: true }),
                { message: ErrorMessage.keyValidateRejected('name') },
            );

            expect(() => parser.parse({ filters: { name: 'x' } }, { schema: 'user', throwOnFailure: false }))
                .not.toThrow();
        });

        it('should not raise a replaced filter leaf', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                throwOnFailure: true,
                filters: {
                    allowed: ['id', 'name'],
                    validate: (leaf) => (leaf.field === 'name' ? eq('id', '1') : leaf),
                },
            }));

            const parser = new SimpleParser(registry);
            const query = parser.parse({ filters: { name: 'x' } }, { schema: 'user' });

            expect(query.filters.value).toHaveLength(1);
        });
    });

    describe('relation gating', () => {
        it('should report what a rejected relation took with it', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                fields: { allowed: ['id'] },
                relations: {
                    allowed: ['items'], 
                    validate: () => false, 
                    throwOnFailure: true, 
                },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({
                name: 'item',
                fields: { allowed: ['id'] },
            }));

            const parser = new SimpleParser(registry);
            const { error, issues } = trace(() => parser.parse({
                relations: ['items'],
                fields: { items: ['id'] },
            }, { schema: 'user' }));

            expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(findIssue(issues, Parameter.RELATIONS, ErrorCode.KEY_VALIDATE_REJECTED)?.path)
                .toEqual(['items']);
        });

        it('should honor a call-time policy override on a standalone parse', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                filters: { allowed: ['id'] },
                relations: { allowed: ['items'], validate: () => false },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({ name: 'item', filters: { allowed: ['id'] } }));

            const parser = new SimpleParser(registry);

            // `throwOnFailure ?? schema.relations.throwOnFailure ?? false` is
            // what the query pass applies; a single-parameter parse authorizes
            // relations under the same rule
            expectRejected(
                () => parser.parseFilters({ 'items.id': '1' }, { schema: 'user', throwOnFailure: true }),
                { message: ErrorMessage.keyValidateRejected('items') },
            );

            expect(parser.parseFilters({ 'items.id': '1' }, { schema: 'user' }).value)
                .toHaveLength(0);
        });
    });
});
