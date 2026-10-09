/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Regenerates the conformance fixtures.
 *
 * - packages/parser-expression/fixtures/expression.json: the schemaless cases of the expression
 *   parser's unit specs plus tokenizer edge cases. The expected output
 *   is whatever the TypeScript reference (`@rapiq/parser-expression`)
 *   produces, so the Rust port is held to it exactly.
 * - packages/adapter-memory/fixtures/evaluate.json: filter trees with records and expected
 *   verdicts, taken from `@rapiq/adapter-memory`'s filter specs. The
 *   verdicts are written by hand (the conformance suite re-checks them
 *   against the TypeScript reference); the complement-law matrix is
 *   computed from the reference.
 * - packages/core/fixtures/plan.json: `planCondition` and
 *   `distributeNegation` output of the TypeScript reference for every
 *   evaluation tree plus special values (host references) and refusals
 *   (with the exact messages).
 *
 * Run (after `npm run build`):
 *   node --experimental-strip-types conformance/scripts/generate.ts
 */

import { writeFileSync } from 'node:fs';
import { flattenIssueItems } from '@ebec/core';
import type { ICondition } from '@rapiq/core';
import { isParseError, toIR  } from '@rapiq/core';
import { ExpressionFiltersParser } from '@rapiq/parser-expression';
import { buildEvaluateGroups } from './evaluate.ts';
import { buildPlanGroups } from './plan.ts';

const INPUTS : string[] = [
    // leaves
    'eq(name, \'admin\')',
    'lt(age, \'18\')',
    'lte(age, \'18\')',
    'gt(age, \'18\')',
    'gte(age, \'18\')',
    'contains(name, \'Peter\')',
    'startsWith(name, \'Peter\')',
    'endsWith(name, \'Peter\')',
    'in(name, \'Peter\', \'Hans\')',
    'nin(name, \'Peter\', \'Hans\')',
    'in(name)',
    'in(name, null, \'a\')',
    'eq(name, null)',
    'size(items,\'2\')',
    'size(items,\'0\')',
    // negation normalization
    'not(eq(name, \'admin\'))',
    'not(not(eq(name, \'admin\')))',
    'not(gt(age, \'18\'))',
    'not(not(gt(age, \'18\')))',
    'not(contains(name, \'Peter\'))',
    'not(startsWith(name, \'Peter\'))',
    'not(endsWith(name, \'Peter\'))',
    'not(in(name, \'Peter\', \'Hans\'))',
    'not(nin(name, \'Peter\', \'Hans\'))',
    'not(size(items,\'2\'))',
    'not(and(eq(a, \'1\'), eq(b, \'2\')))',
    'not(not(and(eq(a, \'1\'), eq(b, \'2\'))))',
    // groups
    'and(eq(name, \'admin\'), eq(age, \'18\'))',
    'or(eq(name, \'admin\'), eq(name, \'guest\'))',
    'or(and(eq(name, \'John\'), gte(age, \'18\')), in(status, \'active\', \'pending\'))',
    'and(or(eq(name, \'admin\')))',
    // elemMatch and ITSELF
    'elemMatch(items,eq(name,\'chess\'))',
    'elemMatch(scores,gt($this,\'5\'))',
    'elemMatch(matrix,elemMatch($this,gt($this,\'5\')))',
    'elemMatch(matrix,size($this,\'2\'))',
    'not(elemMatch(items,eq(id,\'1\')))',
    'elemMatch(items.tags,eq($this,\'x\'))',
    // identifiers
    'eq(order, \'asc\')',
    'eq(notes, \'foo\')',
    'gt(inventory, \'5\')',
    'eq(_id, \'value\')',
    'eq(first-name, \'x\')',
    'eq(items.realm.name, \'x\')',
    'eq(toString, \'x\')',
    'eq(constructor, \'x\')',
    'eq(123, \'x\')',
    // value grammar
    'eq(age, \' 18 \')',
    'eq(age, \'1.5\')',
    'eq(age, \'.5\')',
    'eq(age, \'1e3\')',
    'eq(age, \'0x1F\')',
    'eq(age, \'-0\')',
    'eq(age, \'00012\')',
    'eq(flag, \'TRUE\')',
    'eq(flag, \'False\')',
    'eq(flag, \'NULL\')',
    'eq(name, \'\')',
    'eq(name, \'   \')',
    'eq(name, \'it\'\'s\')',
    'eq(name, \'a,b\')',
    'eq(name, \'\'\'quoted\'\'\')',
    'contains(title, \'2024\')',
    'contains(title, \'  spaced  \')',
    'contains(title, \'it\'\'s\')',
    'eq(name, \'Ünïcödé 🎉\')',
    'eq(name,\'x\')',
    '  eq ( name ,  \'x\' )  ',
    'eq(name,\t\'x\'\n)',
    // rejected
    '',
    'eq(name \'admin\')',
    'eq(name, \'admin\'',
    'eq(name, \'admin\'))',
    'eq(name, admin)',
    'eq(name, \'a',
    'eq(name, \'a\'\')',
    'eq(na me, \'x\')',
    'eq(name, \'x\') eq(a, \'1\')',
    'foo(name, \'x\')',
    'and()',
    'eq(first-, \'x\')',
    'eq(name.,\'x\')',
    'eq(name, \'x\');',
    'eq(name, "x")',
    'size(items,\'2.5\')',
    'size(items,\'-1\')',
    'size(items,\'abc\')',
    'size(items,null)',
    'eq($this,\'5\')',
    'elemMatch($this,eq(id,\'1\'))',
    'eq($foo,\'5\')',
    'eq($,\'5\')',
    'elemMatch(items,eq($this.name,\'x\'))',
    `${'not('.repeat(40)}eq(a, '1')${')'.repeat(40)}`,
    `${'and('.repeat(32)}eq(a, '1')${')'.repeat(32)}`,
    `${'and('.repeat(33)}eq(a, '1')${')'.repeat(33)}`,
    'eq(name, \'x\') ',
    'eq(name, \'x\')\u0085',
    'eq(näme, \'x\')',
];

type Case = {
    input: string,
    exact?: unknown,
    parse?: unknown,
    error?: string,
};

const parser = new ExpressionFiltersParser();

function run(fn: () => ICondition) : { value?: unknown, error?: string } {
    try {
        return { value: toIR(fn()) };
    } catch (e) {
        if (!isParseError(e)) {
            throw e;
        }

        const [item] = flattenIssueItems([...(e.issues ?? [])]);

        return { error: item?.code ?? e.code };
    }
}

const cases : Case[] = INPUTS.map((input) => {
    const exact = run(() => parser.parseExact(input));
    if (exact.error) {
        return { input, error: exact.error };
    }

    const parse = run(() => parser.parse(input));

    return {
        input, 
        exact: exact.value, 
        parse: parse.value, 
    };
});

function write(name: string, data: unknown[]) : void {
    // fixtures live next to the package whose semantics they pin (P7)
    const target = new URL(`../../packages/${name}`, import.meta.url);
    writeFileSync(target, `${JSON.stringify(data, null, 4)}\n`);

    // eslint-disable-next-line no-console
    console.log(`wrote ${data.length} entries to ${target.pathname}`);
}

const evaluate = buildEvaluateGroups();

write('parser-expression/fixtures/expression.json', cases);
write('adapter-memory/fixtures/evaluate.json', evaluate);
write('core/fixtures/plan.json', buildPlanGroups(evaluate));
