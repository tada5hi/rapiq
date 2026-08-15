/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isIssueGroup } from 'blemish';
import type { Issue } from 'blemish';

const CIRCULAR = '[Circular]';

function serializeValue(input: unknown, seen: WeakSet<object>, arrayValue = false) : unknown {
    if (typeof input === 'bigint') {
        return input.toString();
    }

    if (
        input === null ||
        typeof input === 'string' ||
        typeof input === 'boolean' ||
        typeof input === 'number'
    ) {
        return input;
    }

    if (
        typeof input === 'undefined' ||
        typeof input === 'symbol' ||
        typeof input === 'function'
    ) {
        return arrayValue ? null : undefined;
    }

    if (seen.has(input)) {
        return CIRCULAR;
    }

    seen.add(input);
    if (Array.isArray(input)) {
        return input.map((value) => serializeValue(value, seen, true));
    }

    const output : Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        const serialized = serializeValue(value, seen);
        if (typeof serialized !== 'undefined') {
            output[key] = serialized;
        }
    }

    return output;
}

function serializeIssue(input: Issue, seen: WeakSet<object>) : Issue {
    seen.add(input);

    const output : Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        if (key === 'received' || key === 'issues') {
            continue;
        }

        const serialized = serializeValue(value, seen);
        if (typeof serialized !== 'undefined') {
            output[key] = serialized;
        }
    }

    if (isIssueGroup(input)) {
        output.issues = input.issues.map((issue) => serializeIssue(issue, seen));
    }

    return output as unknown as Issue;
}

export function serializeIssues(input: readonly Issue[]) : Issue[] {
    const seen = new WeakSet<object>();
    return input.map((issue) => serializeIssue(issue, seen));
}
