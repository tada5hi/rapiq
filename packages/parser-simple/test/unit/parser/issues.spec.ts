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
        fields: { allowed: ['id'] },
        filters: { allowed: ['id'] },
        sorts: { allowed: ['id'] },
    }));

    return registry;
};

const findIssue = (
    issues: Issue[],
    parameter: `${Parameter}`,
    code?: `${ErrorCode}`,
) => issues.find((issue) => issue.parameter === parameter &&
    (typeof code === 'undefined' || issue.code === code));

describe('src/parser — issue traces', () => {
    describe('drop mode', () => {
        it('should report a disallowed key it silently dropped', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            const query = parser.parse({ fields: ['id', 'secret'] }, { schema: 'user', issues });

            expect(query.fields.value.map((field) => field.name)).toEqual(['id']);
            expect(issues).toHaveLength(1);
            expect(issues[0]).toEqual({
                code: ErrorCode.KEY_NOT_ALLOWED,
                parameter: Parameter.FIELDS,
                path: ['secret'],
                key: 'secret',
                message: ErrorMessage.keyNotPermitted('secret'),
                severity: 'warning',
            });
        });

        it('should report the raw client key of a rejected relation path', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parse({ filters: { 'items.secret': 'x' } }, { schema: 'user', issues });

            const issue = findIssue(issues, Parameter.FILTERS);
            // the canonical position is complete; `key` is the raw spelling
            // at the position that failed, which is what alias mapping makes
            // worth keeping.
            expect(issue?.path).toEqual(['items', 'secret']);
            expect(issue?.key).toBe('secret');
            expect(issue?.severity).toBe('warning');
        });

        it('should report every dropped key rather than only the first', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parse({
                fields: ['nope1', 'nope2'],
                filters: { nope3: 'x' },
                sorts: ['nope4'],
                relations: ['nope5'],
            }, { schema: 'user', issues });

            expect(issues.filter((issue) => issue.severity === 'warning').length)
                .toBeGreaterThanOrEqual(5);
            expect(findIssue(issues, Parameter.FIELDS)).toBeDefined();
            expect(findIssue(issues, Parameter.FILTERS)).toBeDefined();
            expect(findIssue(issues, Parameter.SORTS)).toBeDefined();
            expect(findIssue(issues, Parameter.RELATIONS)).toBeDefined();
        });

        it('should report a clamped pagination limit', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            const query = parser.parse({ pagination: { limit: 500 } }, { schema: 'user', issues });

            expect(query.pagination.limit).toBe(50);
            expect(findIssue(issues, Parameter.PAGINATION)).toEqual({
                code: ErrorCode.LIMIT_EXCEEDED,
                parameter: Parameter.PAGINATION,
                path: ['limit'],
                input: 500,
                message: ErrorMessage.limitExceeded(50),
                severity: 'warning',
            });
        });

        it('should report an unusable pagination value', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parse({ pagination: { offset: 'abc' } }, { schema: 'user', issues });

            const issue = findIssue(issues, Parameter.PAGINATION, ErrorCode.KEY_VALUE_INVALID);
            expect(issue?.path).toEqual(['offset']);
            expect(issue?.input).toBe('abc');
        });

        it('should report substituted defaults', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            const query = parser.parse({ sorts: ['nope'] }, { schema: 'user', issues });

            expect(query.sorts.value.map((sort) => sort.name)).toEqual(['name']);
            expect(findIssue(issues, Parameter.SORTS, ErrorCode.NONE)?.message)
                .toBe(ErrorMessage.defaultsApplied());
        });

        it('should report an input of the wrong shape', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parse({ pagination: 'nope' }, { schema: 'user', issues });

            expect(findIssue(issues, Parameter.PAGINATION, ErrorCode.INPUT_INVALID)).toBeDefined();
        });

        it('should leave the trace untouched when nothing was dropped', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parse({ fields: ['id'], filters: { name: 'x' } }, { schema: 'user', issues });

            expect(issues).toEqual([]);
        });

        it('should cap a hostile trace', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            const fields : string[] = [];
            for (let i = 0; i < MAX_ISSUES + 50; i++) {
                fields.push(`nope${i}`);
            }

            parser.parse({ fields }, { schema: 'user', issues });

            expect(issues).toHaveLength(MAX_ISSUES);
        });
    });

    describe('throw mode', () => {
        it('should throw the first violation with the trace attached', () => {
            const parser = new SimpleParser(buildRegistry(true));
            const issues : Issue[] = [];

            let error : FieldsParseError | undefined;
            try {
                parser.parse({
                    fields: ['nope1'],
                    filters: { nope2: 'x' },
                    sorts: ['nope3'],
                }, { schema: 'user', issues });
            } catch (e) {
                error = e as FieldsParseError;
            }

            // first-issue-wins: same class, code and message the fail-fast
            // path threw before aggregation existed.
            expect(error).toBeInstanceOf(FieldsParseError);
            expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
            expect(error?.message).toBe(ErrorMessage.keyNotPermitted('nope1'));

            // ... but every parameter got its say
            expect(issues).toEqual([...(error?.issues ?? [])]);
            expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(3);

            expect(findIssue(issues, Parameter.FILTERS)).toBeDefined();
            expect(findIssue(issues, Parameter.SORTS)).toBeDefined();
        });

        it('should aggregate the keys of one parameter', () => {
            const parser = new SimpleParser(buildRegistry(true));
            const issues : Issue[] = [];

            expect(() => parser.parse({ fields: ['a', 'b', 'c'] }, { schema: 'user', issues }))
                .toThrow(FieldsParseError);

            expect(issues.map((issue) => issue.path)).toEqual([['a'], ['b'], ['c']]);
        });

        it('should keep a parameter failure from hiding the others', () => {
            const parser = new SimpleParser(buildRegistry(true));
            const issues : Issue[] = [];

            expect(() => parser.parse({
                filters: 'not-an-object',
                sorts: ['nope'],
            }, { schema: 'user', issues })).toThrow(FiltersParseError);

            // the filters input aborted its own parameter, the sorts key
            // still reported
            expect(findIssue(issues, Parameter.FILTERS, ErrorCode.INPUT_INVALID)).toBeDefined();
            expect(findIssue(issues, Parameter.SORTS)).toBeDefined();
        });

        it('should throw the pagination limit violation it used to throw', () => {
            const parser = new SimpleParser(buildRegistry(true));

            expect(() => parser.parse({ pagination: { limit: 500 } }, { schema: 'user' }))
                .toThrow(PaginationParseError.limitExceeded(50));
        });

        it('should still populate the sink of a failing parse', () => {
            const parser = new SimpleParser(buildRegistry(true));
            const issues : Issue[] = [];

            expect(() => parser.parse({ fields: ['nope'] }, { schema: 'user', issues }))
                .toThrow(FieldsParseError);

            expect(issues).toHaveLength(1);
            expect(issues[0]?.severity).toBe('error');
        });
    });

    describe('standalone parameter parsers', () => {
        it('should record and raise on their own', () => {
            const parser = new SimpleParser(buildRegistry(true));
            const issues : Issue[] = [];

            expect(() => parser.parseFields(['nope'], { schema: 'user', issues }))
                .toThrow(FieldsParseError);

            expect(issues).toHaveLength(1);
            expect(issues[0]?.parameter).toBe(Parameter.FIELDS);
        });

        it('should record drops without raising', () => {
            const parser = new SimpleParser(buildRegistry());
            const issues : Issue[] = [];

            parser.parseSorts(['nope'], { schema: 'user', issues });

            expect(issues.some((issue) => issue.severity === 'warning')).toBeTruthy();
        });
    });

    describe('parameter drivers', () => {
        it('should raise a violation it recorded when driven directly', () => {
            const parser = new SimpleFieldsParser(buildRegistry(true));
            const issues : Issue[] = [];

            // parseParameter is the query orchestrator's driver, but nothing
            // stops a caller from using it: whoever starts a trace finishes
            // it, so a rejection never degrades into a silent drop.
            expect(() => parser.parseParameter(['nope'], { schema: 'user', issues }, []))
                .toThrow(FieldsParseError);

            expect(issues).toHaveLength(1);
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
            // client-facing failure stays the first violation.
            expect(() => parser.parse({ relations: ['items'] }, { schema: 'user' }))
                .toThrow(RelationsParseError.keyValidateRejected('items'));
        });
    });

    describe('validate hooks', () => {
        it('should report a rejected key', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                fields: { allowed: ['id', 'name'], validate: (key) => key !== 'name' },
            }));

            const parser = new SimpleParser(registry);
            const issues : Issue[] = [];

            parser.parse({ fields: ['id', 'name'] }, { schema: 'user', issues });

            const issue = findIssue(issues, Parameter.FIELDS, ErrorCode.KEY_VALIDATE_REJECTED);
            expect(issue?.path).toEqual(['name']);
            expect(issue?.severity).toBe('warning');
        });

        it('should report a rejected filter leaf', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                filters: {
                    allowed: ['id', 'name'],
                    validate: (leaf) => (leaf.field === 'name' ? undefined : leaf),
                },
            }));

            const parser = new SimpleParser(registry);
            const issues : Issue[] = [];

            const query = parser.parse({ filters: { id: '1', name: 'x' } }, { schema: 'user', issues });

            expect(query.filters.value).toHaveLength(1);
            expect(findIssue(issues, Parameter.FILTERS, ErrorCode.KEY_VALIDATE_REJECTED)).toEqual({
                code: ErrorCode.KEY_VALIDATE_REJECTED,
                parameter: Parameter.FILTERS,
                path: ['name'],
                message: ErrorMessage.keyValidateRejected('name'),
                severity: 'warning',
            });
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
            const issues : Issue[] = [];

            const query = parser.parse({ filters: { name: 'x' } }, { schema: 'user', issues });

            expect(query.filters.value).toHaveLength(1);
            expect(issues).toEqual([]);
        });
    });

    describe('relation gating', () => {
        it('should report what a rejected relation took with it', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<User>({
                name: 'user',
                fields: { allowed: ['id'] },
                relations: { allowed: ['items'], validate: () => false },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({
                name: 'item',
                fields: { allowed: ['id'] },
            }));

            const parser = new SimpleParser(registry);
            const issues : Issue[] = [];

            const query = parser.parse({
                relations: ['items'],
                fields: { items: ['id'] },
            }, { schema: 'user', issues });

            expect(query.relations.value).toHaveLength(0);
            expect(query.fields.value.map((field) => field.name)).not.toContain('items.id');

            // the relation itself, reported once by the gate ...
            expect(findIssue(issues, Parameter.RELATIONS, ErrorCode.KEY_VALIDATE_REJECTED)?.path)
                .toEqual(['items']);
            // ... and the field it dragged along
            expect(findIssue(issues, Parameter.FIELDS, ErrorCode.KEY_PATH_NOT_ALLOWED)?.path)
                .toEqual(['items', 'id']);
        });
    });
});
