/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    Group,
    Groups,
    Parameter,
    ResolutionScope,
} from '@rapiq/core';
import type {
    GroupsParseOptions,
    IGroups,
    IIssueCollector,
    ObjectLiteral,
    RelationLedger,
} from '@rapiq/core';
import { buildCallNodes } from '../call/resolve';

export class SimpleGroupsParser extends BaseParser<GroupsParseOptions, IGroups> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: GroupsParseOptions<RECORD> = {}) : IGroups {
        return this.build(input, options);
    }

    // groups name root columns only, so the ledger is unused.
    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: GroupsParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IGroups {
        return this.build(input, options, issueCollector);
    }

    // `async`, not a wrapped return: `build` raises synchronously, so without
    // it the throw escapes before the promise exists.
    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: GroupsParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IGroups> {
        return this.build(input, options, issueCollector);
    }

    /**
     * `driver` is the enclosing query parse's trace, when there is one: this
     * parser then records into it and leaves the raising to its owner.
     */
    protected build<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: GroupsParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : IGroups {
        return this.withTrace({ parameter: Parameter.GROUPS, driver }, (issueCollector) => {
            const schema = typeof options.schema === 'undefined' ?
                undefined :
                ResolutionScope.for(this.registry, Parameter.GROUPS, options.schema).schema;

            return new Groups(buildCallNodes(
                Parameter.GROUPS,
                input,
                schema,
                issueCollector,
                (term, lowering) => new Group({
                    name: term.name,
                    params: term.params,
                    lowering,
                }),
            ));
        });
    }
}
