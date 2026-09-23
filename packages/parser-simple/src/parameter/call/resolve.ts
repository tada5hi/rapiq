/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    ErrorMessage,
    Parameter,
    resolveCallTerm,
} from '@rapiq/core';
import type {
    AggregatesSchema,
    CallLowering,
    CallTerm,
    ErrorCodeInput,
    GroupsSchema,
    IIssueCollector,
    IssueInput,
} from '@rapiq/core';
import { parseCallTerms, serializeCallTerm } from './module';

function record(
    issueCollector: IIssueCollector,
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    term: CallTerm,
    code: ErrorCodeInput,
    message: string,
) : void {
    const issue : IssueInput = {
        parameter,
        code,
        path: [term.name],
        message,
    };

    if (term.params.length > 0) {
        issue.key = serializeCallTerm(term);
    }

    issueCollector.add(issue);
}

/**
 * Parse and resolve every term of one call parameter.
 *
 * A rejected term is recorded whatever the failure policy: dropping a
 * group changes what every row means, and dropping an aggregate removes a
 * key the client reads, so there is no drop path. Each term is judged, so
 * one request reports all of its bad terms.
 */
export function buildCallNodes<NODE extends { key: string }>(
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    input: unknown,
    schema: GroupsSchema | AggregatesSchema | undefined,
    issueCollector: IIssueCollector,
    create: (term: CallTerm, lowering: CallLowering) => NODE,
) : NODE[] {
    const output : NODE[] = [];
    const keys = new Set<string>();
    const columns = new Set<string>();

    for (const term of parseCallTerms(input)) {
        const resolution = resolveCallTerm(parameter, term, schema);
        if (!resolution.success) {
            record(issueCollector, parameter, term, resolution.code, resolution.message);
            continue;
        }

        // a row carries one value per column, so a column is grouped once
        // whatever the spelling: createdAt,bucket(createdAt,day) too.
        const column = parameter === Parameter.GROUPS ? resolution.lowering.field : undefined;
        if (column && columns.has(column)) {
            record(issueCollector, parameter, term, ErrorCode.KEY_AMBIGUOUS, ErrorMessage.groupColumnDuplicate(column));
            continue;
        }

        const node = create(term, resolution.lowering);
        if (keys.has(node.key)) {
            record(issueCollector, parameter, term, ErrorCode.KEY_AMBIGUOUS, ErrorMessage.outputKeyDuplicate(node.key));
            continue;
        }

        keys.add(node.key);
        if (column) {
            columns.add(column);
        }

        output.push(node);
    }

    return output;
}

/**
 * Record a resolved term the schema validate hook rejected. Like every
 * rejection of these parameters it fails the parse.
 */
export function recordCallRejected(
    issueCollector: IIssueCollector,
    parameter: `${Parameter.GROUPS}` | `${Parameter.AGGREGATES}`,
    node: { name: string, params: readonly string[] },
) : void {
    const term = { name: node.name, params: [...node.params] };

    record(
        issueCollector,
        parameter,
        term,
        ErrorCode.KEY_VALIDATE_REJECTED,
        ErrorMessage.keyValidateRejected(serializeCallTerm(term)),
    );
}
