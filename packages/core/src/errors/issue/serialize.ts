/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Issue, IssueGroup } from 'blemish';

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

    const entries : [string, unknown][] = [];
    for (const key of Object.keys(input)) {
        const value = (input as Record<string, unknown>)[key];
        const serialized = serializeValue(value, seen);
        if (typeof serialized !== 'undefined') {
            entries.push([key, serialized]);
        }
    }

    return Object.fromEntries(entries);
}

function serializeIssue(input: Issue, seen: WeakSet<object>) : Issue {
    seen.add(input);

    const entries : [string, unknown][] = [];
    for (const key of Object.keys(input)) {
        if (key === 'received' || key === 'issues') {
            continue;
        }

        const value = (input as unknown as Record<string, unknown>)[key];
        const serialized = serializeValue(value, seen);
        if (typeof serialized !== 'undefined') {
            entries.push([key, serialized]);
        }
    }

    const output : Record<string, unknown> = Object.fromEntries(entries);
    if (output.type === 'group') {
        const group = input as IssueGroup;
        output.issues = group.issues.map((issue) => serializeIssue(issue, seen));
    }

    return output as unknown as Issue;
}

export function serializeIssues(input: readonly Issue[]) : Issue[] {
    const seen = new WeakSet<object>();
    return input.map((issue) => serializeIssue(issue, seen));
}
