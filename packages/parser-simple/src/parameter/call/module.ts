/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParseError } from '@rapiq/core';
import type { CallTerm } from '@rapiq/core';

/**
 * One term: an identifier, optionally followed by a parenthesized list of
 * identifiers. An identifier carries no parenthesis, comma, quote or
 * whitespace; quotes stay reserved for a future literal argument. Whether
 * an identifier is a valid key is resolution's question, not the grammar's.
 */
const TERM_PATTERN = /^[ \t]*([^\s(),'"]+)[ \t]*(?:\(([^()]*)\)[ \t]*)?$/u;

const ARGUMENT_PATTERN = /^[^\s(),'"]+$/u;

/**
 * The grammar's only whitespace is space and tab; `String#trim()` would
 * also strip line breaks and unicode spaces the term pattern refuses.
 */
function trimBlank(input: string) : string {
    return input.replace(/^[ \t]+|[ \t]+$/gu, '');
}

function splitTerms(input: string) : string[] {
    const output : string[] = [];

    let depth = 0;
    let start = 0;
    for (let index = 0; index < input.length; index++) {
        const char = input[index];
        if (char === '(') {
            depth++;
            if (depth > 1) {
                throw ParseError.syntaxInvalid('a call term nests parentheses');
            }
        } else if (char === ')') {
            depth--;
            if (depth < 0) {
                throw ParseError.syntaxInvalid('a call term has unbalanced parentheses');
            }
        } else if (char === ',' && depth === 0) {
            output.push(input.substring(start, index));
            start = index + 1;
        }
    }

    if (depth !== 0) {
        throw ParseError.syntaxInvalid('a call term has unbalanced parentheses');
    }

    output.push(input.substring(start));

    return output;
}

function parseTerm(input: string) : CallTerm {
    const match = TERM_PATTERN.exec(input);
    const name = match?.[1];
    if (typeof name === 'undefined') {
        throw ParseError.syntaxInvalid('a call term is empty or malformed');
    }

    const list = trimBlank(match?.[2] ?? '');
    if (list === '') {
        return { name, params: [] };
    }

    const params = list.split(',').map((param) => trimBlank(param));
    if (params.some((param) => !ARGUMENT_PATTERN.test(param))) {
        throw ParseError.syntaxInvalid('a call argument is empty or malformed');
    }

    return { name, params };
}

/**
 * Read the wire form of `groups` / `aggregates`: one string or an array of
 * strings (repeated query keys), each a comma separated list of terms.
 * `count` and `count()` are the same term. Undefined and empty lists read
 * as no terms.
 */
export function parseCallTerms(input: unknown) : CallTerm[] {
    if (typeof input === 'undefined') {
        return [];
    }

    const lists = Array.isArray(input) ? input : [input];

    const output : CallTerm[] = [];
    for (const list of lists) {
        if (typeof list !== 'string') {
            throw ParseError.inputInvalid();
        }

        if (trimBlank(list) === '') {
            continue;
        }

        for (const term of splitTerms(list)) {
            output.push(parseTerm(term));
        }
    }

    return output;
}

/**
 * The wire form of one term: `name` without arguments, `name(a,b)`
 * otherwise.
 */
export function serializeCallTerm(term: CallTerm) : string {
    if (term.params.length === 0) {
        return term.name;
    }

    return `${term.name}(${term.params.join(',')})`;
}
