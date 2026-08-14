/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FiltersParseError,
    Parameter,
    SchemaRegistry,
    defineSchema,
    eq,
} from '@rapiq/core';
import { ExpressionParser } from '../../src';

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

describe('src/parameter/filters — issue traces', () => {
    it('should record the failure it fails fast on', () => {
        const parser = new ExpressionParser(buildRegistry());

        // the dialect resolves under an always-throwing scope on purpose —
        // an expression cannot be partially reinterpreted — so the failure is
        // structural. It still lands in the trace on its way out.
        let error : FiltersParseError | undefined;
        try {
            parser.parseFilters("eq(secret, 'x')", { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error).toBeInstanceOf(FiltersParseError);
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]).toMatchObject({
            type: 'item',
            parameter: Parameter.FILTERS,
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
        expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
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
        expect(issues.some((issue) => issue.parameter === Parameter.FILTERS &&
            issue.code === ErrorCode.SYNTAX_INVALID)).toBeTruthy();

        // ... and the fields parameter still reported its own drop
        expect(issues.some((issue) => issue.parameter === Parameter.FIELDS)).toBeTruthy();
    });

    it('should raise the abort as itself', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: 'not-an-expression(' }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        // the abort IS the raised error, carrying the trace it produced
        expect(error?.code).toBe(ErrorCode.SYNTAX_INVALID);
        expect(error?.issues).toHaveLength(1);
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

        expect(query.filters.value).toHaveLength(1);
    });

    it('should report the drops of the parameters it delegates', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ fields: ['secret'], sorts: ['secret'] }, { schema: 'row', throwOnFailure: true });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect((error?.issues ?? []).map((issue) => issue.parameter)).toEqual([
            Parameter.FIELDS,
            Parameter.SORTS,
        ]);
    });
});
