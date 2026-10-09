/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CallTerm, IAggregate, IGroup } from '@rapiq/core';
import { AdapterError, isParseError } from '@rapiq/core';
import { parseCallTerms, serializeCallTerm } from '@rapiq/parser-simple';

function reparseCallTerms(input: string, feature: string) : CallTerm[] {
    try {
        return parseCallTerms(input);
    } catch (e) {
        if (isParseError(e)) {
            throw AdapterError.featureUnsupported(feature);
        }

        throw e;
    }
}

/**
 * Serialize one term and hold it to the subset law pointwise: the emitted
 * token must parse back to exactly the term it came from. A name or an
 * argument carrying a grammar character (comma, parenthesis, quote,
 * surrounding whitespace) or an empty one would otherwise decode as a
 * different term, a different number of terms, or not at all.
 *
 * @param term
 * @param feature
 */
export function serializeCallTermStrict(term: IGroup | IAggregate, feature: string) : string {
    const output = serializeCallTerm({ name: term.name, params: [...term.params] });
    const parsed = reparseCallTerms(output, feature);
    const [first] = parsed;

    if (
        parsed.length !== 1 ||
        typeof first === 'undefined' ||
        first.name !== term.name ||
        first.params.length !== term.params.length ||
        first.params.some((param, index) => param !== term.params[index])
    ) {
        throw AdapterError.featureUnsupported(feature);
    }

    return output;
}
