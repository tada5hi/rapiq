/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseError } from '@rapiq/core';
import {
    ErrorCode,
    ITSELF,
    Parameter,
    SchemaRegistry,
    defineSchema,
    eq,
    extractIssueParameter,
} from '@rapiq/core';
import { ExpressionFiltersParser, ExpressionParser } from '../../src';

type Row = { id: string, name: string };

const buildRegistry = () => {
    const registry = new SchemaRegistry();

    registry.add(defineSchema<Row>({
        name: 'row',
        fields: { allowed: ['id', 'name'] },
        filters: { allowed: ['id', 'name'] },
        sorts: { allowed: ['id', 'name'] },
    }));

    return registry;
};

describe('src/parameter/filters: issue traces', () => {
    it('should report absolute validator paths inside elemMatch through exact entry points', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            filters: {
                allowed: ['items'],
                throwOnFailure: true,
                validate: (leaf) => (leaf.field === 'id' ? undefined : leaf),
            },
        }));
        const parser = new ExpressionFiltersParser(registry);

        for (const run of [
            () => Promise.resolve().then(() => parser.parseExact("elemMatch(items,eq(id,'1'))", { schema: 'row' })),
            () => parser.parseExactAsync("elemMatch(items,eq(id,'1'))", { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the validator rejection');
            } catch (error) {
                const parsed = error as FiltersParseError;
                expect(parsed.issues[0]?.path).toEqual(['items', 'id']);
                expect(extractIssueParameter(parsed.issues[0]!)).toBe(Parameter.FILTERS);
            }
        }
    });

    it('should not add an ITSELF segment to an exact elemMatch validator path', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            filters: {
                allowed: ['items'],
                throwOnFailure: true,
                validate: (leaf) => (leaf.field === ITSELF ? undefined : leaf),
            },
        }));
        const parser = new ExpressionFiltersParser(registry);

        for (const run of [
            () => Promise.resolve().then(() => parser.parseExact("elemMatch(items,eq($this,'1'))", { schema: 'row' })),
            () => parser.parseExactAsync("elemMatch(items,eq($this,'1'))", { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the validator rejection');
            } catch (error) {
                expect((error as FiltersParseError).issues[0]?.path).toEqual(['items']);
            }
        }
    });

    it('should populate the trace of parseExact syntax failures', async () => {
        const parser = new ExpressionFiltersParser(buildRegistry());

        for (const run of [
            () => Promise.resolve().then(() => parser.parseExact('broken(')),
            () => parser.parseExactAsync('broken('),
        ]) {
            try {
                await run();
                expect.fail('expected a syntax rejection');
            } catch (error) {
                const parsed = error as FiltersParseError;
                expect(parsed.code).toBe(ErrorCode.INPUT_REJECTED);
                expect(parsed.issues).toHaveLength(1);
                expect(parsed.issues[0]?.code).toBe(ErrorCode.SYNTAX_INVALID);
                expect(extractIssueParameter(parsed.issues[0]!)).toBe(Parameter.FILTERS);
            }
        }
    });

    it('should propagate non-parse errors from parseExact unchanged', async () => {
        const failure = new Error('Validator rejected.');
        const registry = new SchemaRegistry();
        registry.add(defineSchema<Row>({
            name: 'row',
            filters: {
                allowed: ['id'],
                validate: () => {
                    throw failure;
                },
            },
        }));
        const parser = new ExpressionFiltersParser(registry);

        for (const run of [
            () => Promise.resolve().then(() => parser.parseExact("eq(id, '1')", { schema: 'row' })),
            () => parser.parseExactAsync("eq(id, '1')", { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the validator error');
            } catch (error) {
                expect(error).toBe(failure);
            }
        }
    });

    it('should record the failure it fails fast on', () => {
        const parser = new ExpressionParser(buildRegistry());

        // the dialect resolves under an always-throwing scope on purpose;
        // an expression cannot be partially reinterpreted, so the failure is
        // structural. It still lands in the trace on its way out.
        let error : FiltersParseError | undefined;
        try {
            parser.parseFilters("eq(secret, 'x')", { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.issues).toHaveLength(1);
        expect(extractIssueParameter(error!.issues[0]!)).toBe(Parameter.FILTERS);
        expect(error?.issues[0]).toMatchObject({
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            // the dialect fails fast, but the position it failed at survives
            // the throw: the catching driver merges it rather than replacing
            // it with the parameter and nothing else
            path: ['secret'],
        });
    });

    it('should carry the trace on a standalone failure', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parseFilters("eq(secret, 'x')", { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        // rendering a failure goes through error.issues, so a fail-fast
        // dialect must populate it too
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
    });

    it('should keep the other parameters parsing after a filter failure', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({
                filters: 'not-an-expression(',
                fields: ['secret'],
            }, { schema: 'row', throwOnFailure: true });
        } catch (e) {
            error = e as FiltersParseError;
        }

        const issues = error?.issues ?? [];

        // the malformed expression ended its own parameter ...
        expect(issues.some((issue) => extractIssueParameter(issue) === Parameter.FILTERS &&
            issue.code === ErrorCode.SYNTAX_INVALID)).toBeTruthy();

        // ... and the fields parameter still reported its own drop
        expect(issues.some((issue) => extractIssueParameter(issue) === Parameter.FIELDS)).toBeTruthy();
    });

    it('should raise the abort as itself', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: 'not-an-expression(' }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        // the abort becomes an issue of the general failure, which carries
        // the trace it produced
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.code).toBe(ErrorCode.SYNTAX_INVALID);
    });

    it('should not let its always-throwing scope govern the leaf validator', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<Row>({
            name: 'row',
            filters: {
                allowed: ['id', 'name'],
                default: eq('id', '1'),
                validate: (leaf) => (leaf.field === 'name' ? undefined : leaf),
            },
        }));

        const parser = new ExpressionParser(registry);

        // the dialect throws on unresolvable KEYS because an expression cannot
        // be partially reinterpreted; that says nothing about a policy hook
        // declining a leaf, which still drops to the schema default.
        const query = parser.parse({ filters: "eq(name, 'x')" }, { schema: 'row' });

        // the schema default, not the leaf the validator declined
        expect(query.filters.value).toEqual([eq('id', '1')]);
    });

    it('should carry the trace when driven as a parameter', () => {
        const parser = new ExpressionFiltersParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parseParameter("eq(secret, 'x')", { schema: 'row' }, []);
        } catch (e) {
            error = e as FiltersParseError;
        }

        // the driver method owns the trace lifecycle too: whoever starts one
        // raises it, so a rejection never degrades into a silent drop
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
        expect(error?.issues[0]?.path).toEqual(['secret']);
    });

    it('should report the drops of the parameters it delegates', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ fields: ['secret'], sorts: ['secret'] }, { schema: 'row', throwOnFailure: true });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect((error?.issues ?? []).map((issue) => extractIssueParameter(issue))).toEqual([
            Parameter.FIELDS,
            Parameter.SORTS,
        ]);
    });
});
