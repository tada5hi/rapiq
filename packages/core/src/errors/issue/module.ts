/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineIssueItem } from 'blemish';
import type { Issue, IssueItem } from 'blemish';
import type { Parameter } from '../../constants';
import { normalizeParameter } from '../../utils';
import type { IssueInput } from './types';

/**
 * Build the issue a rapiq site reports.
 *
 * The parameter is normalized here, at the one point where it is still
 * typed: past this call it lives in blemish's open `meta` bag, where the
 * deprecated `sort` spelling would survive unnoticed.
 */
export function buildIssue(input: IssueInput) : IssueItem {
    const meta : Record<string, unknown> = {};
    if (input.parameter) {
        meta.parameter = normalizeParameter(input.parameter) as `${Parameter}`;
    }

    if (typeof input.key !== 'undefined') {
        meta.key = input.key;
    }

    const output = defineIssueItem({
        code: input.code,
        path: input.path,
        message: input.message,
    });

    if (Object.keys(meta).length > 0) {
        output.meta = meta;
    }

    if (typeof input.received !== 'undefined') {
        output.received = input.received;
    }

    return output;
}

/**
 * The parameter that owns the policy an issue reports, or undefined for an
 * issue no single parameter owns.
 *
 * `meta` is an open bag by design (issues cross library boundaries), so the
 * read is narrowed here once rather than at every consumer.
 */
export function extractIssueParameter(input: Issue) : `${Parameter}` | undefined {
    const value = input.meta?.parameter;

    return typeof value === 'string' ?
        value as `${Parameter}` :
        undefined;
}

/**
 * The raw client key an issue was recorded for, when it differs from the
 * canonical (alias-resolved) path.
 */
export function extractIssueKey(input: Issue) : string | undefined {
    const value = input.meta?.key;

    return typeof value === 'string' ? value : undefined;
}
