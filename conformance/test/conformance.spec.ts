/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { readFileSync } from 'node:fs';
import { flattenIssueItems } from '@ebec/core';
import { compileFilters as compileReference } from '@rapiq/adapter-memory';
import { 
    fromIR, 
    isBaseError, 
    isParseError, 
    toIR,  
} from '@rapiq/core';
import { ExpressionFiltersParser } from '@rapiq/parser-expression';
import type { ConditionIR } from '@rapiq/core';
import * as rust from '../src/rust';

type ExpressionCase = {
    input: string,
    exact?: ConditionIR,
    parse?: ConditionIR,
    error?: string,
};

type EvaluateGroup = {
    name: string,
    filters: ConditionIR,
    options?: { caseSensitive?: boolean | string[] },
    cases?: { record: Record<string, unknown>, expected: boolean }[],
    error?: string,
};

function load<T>(name: string) : T[] {
    return JSON.parse(readFileSync(new URL(`../../packages/${name}`, import.meta.url), 'utf8'));
}

const expressionCases = load<ExpressionCase>('parser-expression/fixtures/expression.json');
const evaluateGroups = load<EvaluateGroup>('adapter-memory/fixtures/evaluate.json');

function wire<T>(input: T) : T {
    return JSON.parse(JSON.stringify(input));
}

function errorCode(fn: () => unknown) : string | undefined {
    try {
        fn();
    } catch (e) {
        if (isParseError(e)) {
            const [item] = flattenIssueItems([...(e.issues ?? [])]);

            return item?.code ?? e.code;
        }

        if (isBaseError(e)) {
            return e.code;
        }

        return (e as { code?: string }).code;
    }

    return undefined;
}

describe('conformance: expression parser', () => {
    const reference = new ExpressionFiltersParser();

    it('should cover the fixture set', () => {
        expect(expressionCases.length).toBeGreaterThan(90);
    });

    describe.each([
        // the IR is a JSON wire form: compare the reference after the
        // same serialization the fixtures went through (-0 becomes 0).
        ['typescript', {
            exact: (input: string) => wire(toIR(reference.parseExact(input))),
            parse: (input: string) => wire(toIR(reference.parse(input))),
        }],
        ['rust (napi)', {
            exact: (input: string) => rust.parseExpressionFiltersExact(input),
            parse: (input: string) => rust.parseExpressionFilters(input),
        }],
    ])('%s', (_name, impl) => {
        it.each(expressionCases.map((c) => [JSON.stringify(c.input), c] as const))('%s', (_label, item) => {
            if (item.error) {
                expect(errorCode(() => impl.exact(item.input))).toEqual(item.error);
                return;
            }

            expect(impl.exact(item.input)).toEqual(item.exact);
            expect(impl.parse(item.input)).toEqual(item.parse);
        });
    });
});

describe('conformance: evaluator', () => {
    it('should cover the fixture set', () => {
        expect(evaluateGroups.length).toBeGreaterThan(150);
    });

    describe.each([
        ['typescript', (group: EvaluateGroup) => {
            const predicate = compileReference(fromIR(group.filters), group.options);

            return (record: Record<string, unknown>) => predicate(record);
        }],
        ['rust (napi)', (group: EvaluateGroup) => {
            const predicate = rust.compileFilters(group.filters, group.options);

            return (record: Record<string, unknown>) => predicate.test(record);
        }],
    ])('%s', (_name, compile) => {
        it.each(evaluateGroups.map((g) => [g.name, g] as const))('%s', (_label, group) => {
            if (group.error) {
                expect(errorCode(() => compile(group))).toEqual(group.error);
                return;
            }

            const predicate = compile(group);
            for (const item of group.cases ?? []) {
                expect({ record: item.record, verdict: predicate(item.record) })
                    .toEqual({ record: item.record, verdict: item.expected });
            }
        });
    });

    it('should filter a record list through the compiled predicate', () => {
        const predicate = rust.compileFilters(rust.parseExpressionFilters('gte(age, \'18\')'));

        expect(predicate.filter([{ age: 17 }, { age: 18 }, { age: 30 }]))
            .toEqual([{ age: 18 }, { age: 30 }]);
    });
});
