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
} from '@rapiq/core';
import type { Issue } from '@rapiq/core';
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
        const issues : Issue[] = [];

        // the dialect resolves under an always-throwing scope on purpose —
        // an expression cannot be partially reinterpreted — so the failure is
        // structural. It still lands in the trace on its way out.
        expect(() => parser.parseFilters("eq(secret, 'x')", { schema: 'row', issues }))
            .toThrow(FiltersParseError);

        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            parameter: Parameter.FILTERS,
            severity: 'error',
        });
    });

    it('should keep the other parameters parsing after a filter failure', () => {
        const parser = new ExpressionParser(buildRegistry());
        const issues : Issue[] = [];

        expect(() => parser.parse({
            filters: 'not-an-expression(',
            fields: ['secret'],
        }, { schema: 'row', issues })).toThrow(FiltersParseError);

        // the malformed expression ended its own parameter ...
        expect(issues.some((issue) => issue.parameter === Parameter.FILTERS &&
            issue.code === ErrorCode.SYNTAX_INVALID)).toBeTruthy();

        // ... and the fields parameter still reported its own drop
        expect(issues.some((issue) => issue.parameter === Parameter.FIELDS)).toBeTruthy();
    });

    it('should keep the origin of the aggregated failure as its cause', () => {
        const parser = new ExpressionParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: 'not-an-expression(' }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error?.code).toBe(ErrorCode.SYNTAX_INVALID);
        expect(error?.cause).toBeInstanceOf(FiltersParseError);
        expect((error?.cause as FiltersParseError).message).toBe(error?.message);
    });

    it('should report the drops of the parameters it delegates', () => {
        const parser = new ExpressionParser(buildRegistry());
        const issues : Issue[] = [];

        parser.parse({ fields: ['secret'], sorts: ['secret'] }, { schema: 'row', issues });

        expect(issues.map((issue) => issue.parameter)).toEqual([
            Parameter.FIELDS,
            Parameter.SORTS,
        ]);
        expect(issues.every((issue) => issue.severity === 'warning')).toBeTruthy();
    });
});
