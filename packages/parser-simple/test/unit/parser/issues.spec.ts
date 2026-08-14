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
    FiltersParseError,
    MAX_ISSUES,
    PaginationParseError,
    Parameter,
    ParseError,
    RelationsParseError,
    SchemaRegistry,
    defineSchema,
    eq,
    preserve,
} from '@rapiq/core';
import type { Issue } from '@rapiq/core';
import { SimpleFieldsParser, SimpleParser } from '../../../src';
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
) => issues.find((issue) => issue.parameter === parameter &&
    (typeof code === 'undefined' || issue.code === code));

describe('src/parser — issue traces', () => {
    describe('the raise condition', () => {
        it('should raise nothing while the policy drops', () => {
            const parser = new SimpleParser(buildRegistry());

            const query = parser.parse({ fields: ['id', 'secret'] }, { schema: 'user' });

            expect(query.fields.value.map((field) => field.name)).toEqual(['id']);
        });

        it('should raise the first violation once the policy throws', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({ fields: ['id', 'secret'] }, { schema: 'user' }));

            // first-issue-wins: same class, code and message the fail-fast
            // path threw before aggregation existed
            expect(error).toBeInstanceOf(FieldsParseError);
            expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
            expect(error?.message).toBe(ErrorMessage.keyNotPermitted('secret'));

            expect(issues).toHaveLength(1);
            expect(issues[0]).toEqual({
                type: 'item',
                code: ErrorCode.KEY_NOT_ALLOWED,
                parameter: Parameter.FIELDS,
                path: ['secret'],
                key: 'secret',
                message: ErrorMessage.keyNotPermitted('secret'),
            });
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

            // relations parse first, so theirs is the first violation
            expect(error).toBeInstanceOf(RelationsParseError);
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

            expect(error).toBeInstanceOf(FiltersParseError);
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
            expect(issue?.key).toBe('secret');
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

            expect(error).toBeInstanceOf(PaginationParseError);
            expect(findIssue(issues, Parameter.PAGINATION)).toEqual({
                type: 'item',
                code: ErrorCode.LIMIT_EXCEEDED,
                parameter: Parameter.PAGINATION,
                path: ['limit'],
                input: 500,
                message: ErrorMessage.limitExceeded(50),
            });
        });

        it('should carry an unusable pagination value', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { issues } = trace(() => parser.parse({ pagination: { offset: 'abc' } }, { schema: 'user' }));

            const issue = findIssue(issues, Parameter.PAGINATION, ErrorCode.KEY_VALUE_INVALID);
            expect(issue?.path).toEqual(['offset']);
            expect(issue?.input).toBe('abc');
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
            // SchemaError, but it is a CONSEQUENCE of the rejection: the
            // client-facing failure stays the first violation
            expect(() => parser.parse({ relations: ['items'] }, { schema: 'user' }))
                .toThrow(RelationsParseError.keyValidateRejected('items'));
        });

        it('should let an earlier rejection win over a later abort', () => {
            const parser = new SimpleParser(buildRegistry(true));

            const { error, issues } = trace(() => parser.parse({
                fields: ['nope'],
                filters: 'not-an-object',
            }, { schema: 'user' }));

            expect(error).toBeInstanceOf(FieldsParseError);
            expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
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
                .toThrow(FieldsParseError);
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
            expect(() => parser.parse({ filters: { name: 'x' } }, { schema: 'user' }))
                .toThrow(FiltersParseError.keyValidateRejected('name'));
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
            expect(() => parser.parse({ filters: { name: 'x' } }, { schema: 'user', throwOnFailure: true }))
                .toThrow(FiltersParseError.keyValidateRejected('name'));

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

            expect(error).toBeInstanceOf(RelationsParseError);
            expect(findIssue(issues, Parameter.RELATIONS, ErrorCode.KEY_VALIDATE_REJECTED)?.path)
                .toEqual(['items']);
        });
    });
});
