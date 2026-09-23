/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    BaseParser,
    Parameter,
    ResolutionScope,
    applyCallSchemaValidation,
    applyCallSchemaValidationAsync,
} from '@rapiq/core';
import type {
    AggregatesParseOptions,
    AggregatesSchema,
    IAggregates,
    IIssueCollector,
    ObjectLiteral,
    RelationLedger,
} from '@rapiq/core';
import { buildCallNodes, recordCallRejected } from '../call/resolve';

export class SimpleAggregatesParser extends BaseParser<AggregatesParseOptions, IAggregates> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: AggregatesParseOptions<RECORD> = {}) : IAggregates {
        return this.build(input, options);
    }

    override parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: AggregatesParseOptions<RECORD> = {}) : Promise<IAggregates> {
        return this.buildAsync(input, options);
    }

    // aggregates name root columns only, so the ledger is unused.
    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: AggregatesParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IAggregates {
        return this.build(input, options, issueCollector);
    }

    parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: AggregatesParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IAggregates> {
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
        options: AggregatesParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : IAggregates {
        return this.withTrace({ parameter: Parameter.AGGREGATES, driver }, (issueCollector) => {
            const schema = this.resolveSchema(options);

            return new Aggregates(applyCallSchemaValidation(
                this.buildNodes(input, schema, issueCollector),
                schema,
                options.context,
                (node) => recordCallRejected(issueCollector, Parameter.AGGREGATES, node),
            ));
        });
    }

    protected buildAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: AggregatesParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : Promise<IAggregates> {
        return this.withTraceAsync({ parameter: Parameter.AGGREGATES, driver }, async (issueCollector) => {
            const schema = this.resolveSchema(options);

            return new Aggregates(await applyCallSchemaValidationAsync(
                this.buildNodes(input, schema, issueCollector),
                schema,
                options.context,
                (node) => recordCallRejected(issueCollector, Parameter.AGGREGATES, node),
            ));
        });
    }

    protected resolveSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(options: AggregatesParseOptions<RECORD>) : AggregatesSchema | undefined {
        if (typeof options.schema === 'undefined') {
            return undefined;
        }

        return ResolutionScope.for(this.registry, Parameter.AGGREGATES, options.schema).schema;
    }

    protected buildNodes(
        input: unknown,
        schema: AggregatesSchema | undefined,
        issueCollector: IIssueCollector,
    ) : Aggregate[] {
        return buildCallNodes(
            Parameter.AGGREGATES,
            input,
            schema,
            issueCollector,
            (term, lowering) => new Aggregate({
                name: term.name,
                params: term.params,
                lowering,
            }),
        );
    }
}
