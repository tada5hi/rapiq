/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Issue,
    IssueGroup,
    IssueItem,
} from './types';

export function defineIssueItem(input: Omit<IssueItem, 'type'>) : IssueItem {
    return { type: 'item', ...input };
}

export function defineIssueGroup(input: Omit<IssueGroup, 'type'>) : IssueGroup {
    return { type: 'group', ...input };
}

/**
 * The leaves of a trace, in the order the parse hit them. What a consumer
 * rendering one error per rejected key wants — every leaf already knows its
 * absolute position, because merging rewrote it.
 */
export function flattenIssueItems(input: readonly Issue[]) : IssueItem[] {
    const output : IssueItem[] = [];

    for (const issue of input) {
        if (issue.type === 'item') {
            output.push(issue);
        } else {
            output.push(...flattenIssueItems(issue.issues));
        }
    }

    return output;
}

/**
 * Every group of a trace, outer before inner.
 */
export function flattenIssueGroups(input: readonly Issue[]) : IssueGroup[] {
    const output : IssueGroup[] = [];

    for (const issue of input) {
        if (issue.type === 'group') {
            output.push(issue);
            output.push(...flattenIssueGroups(issue.issues));
        }
    }

    return output;
}

/**
 * Rebase a trace onto the position it was merged at, children included.
 *
 * The step that makes a path-less issue impossible to construct: a site
 * reports where something failed relative to itself and never has to know
 * the whole position, because whoever merges its result owns the prefix.
 */
export function prefixIssuePath(input: readonly Issue[], path: string[]) : Issue[] {
    if (path.length === 0) {
        return [...input];
    }

    return input.map((issue) => {
        if (issue.type === 'group') {
            return {
                ...issue,
                path: [...path, ...issue.path],
                issues: prefixIssuePath(issue.issues, path),
            };
        }

        return { ...issue, path: [...path, ...issue.path] };
    });
}
