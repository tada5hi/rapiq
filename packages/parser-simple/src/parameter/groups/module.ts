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
    applyCallSchemaValidation,
    applyCallSchemaValidationAsync,
} from '@rapiq/core';
import type {
    GroupsParseOptions,
    GroupsSchema,
    IGroups,
    IIssueCollector,
    ObjectLiteral,
    RelationLedger,
} from '@rapiq/core';
import { buildCallNodes, recordCallRejected } from '../call/resolve';

export class SimpleGroupsParser extends BaseParser<GroupsParseOptions, IGroups> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: GroupsParseOptions<RECORD> = {}) : IGroups {
        return this.build(input, options);
    }

    override parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: GroupsParseOptions<RECORD> = {}) : Promise<IGroups> {
        return this.buildAsync(input, options);
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

    parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: GroupsParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IGroups> {
        return this.buildAsync(input, options, issueCollector);
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
            const schema = this.resolveSchema(options);

            return new Groups(applyCallSchemaValidation(
                this.buildNodes(input, schema, issueCollector),
                schema,
                options.context,
                (node) => recordCallRejected(issueCollector, Parameter.GROUPS, node),
            ));
        });
    }

    protected buildAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: GroupsParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : Promise<IGroups> {
        return this.withTraceAsync({ parameter: Parameter.GROUPS, driver }, async (issueCollector) => {
            const schema = this.resolveSchema(options);

            return new Groups(await applyCallSchemaValidationAsync(
                this.buildNodes(input, schema, issueCollector),
                schema,
                options.context,
                (node) => recordCallRejected(issueCollector, Parameter.GROUPS, node),
            ));
        });
    }

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(options: GroupsParseOptions<RECORD>) : GroupsSchema | undefined {
        if (typeof options.schema === 'undefined') {
            return undefined;
        }

        return ResolutionScope.for(this.registry, Parameter.GROUPS, options.schema).schema;
    }

    protected buildNodes(
        input: unknown,
        schema: GroupsSchema | undefined,
        issueCollector: IIssueCollector,
    ) : Group[] {
        return buildCallNodes(
            Parameter.GROUPS,
            input,
            schema,
            issueCollector,
            (term, lowering) => new Group({
                name: term.name,
                params: term.params,
                lowering,
            }),
        );
    }
}
