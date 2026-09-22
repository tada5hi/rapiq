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
} from '@rapiq/core';
import type {
    AggregatesParseOptions,
    IAggregates,
    IIssueCollector,
    ObjectLiteral,
    RelationLedger,
} from '@rapiq/core';
import { buildCallNodes } from '../call/resolve';

export class SimpleAggregatesParser extends BaseParser<AggregatesParseOptions, IAggregates> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options: AggregatesParseOptions<RECORD> = {}) : IAggregates {
        return this.build(input, options);
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

    // `async`, not a wrapped return: `build` raises synchronously, so without
    // it the throw escapes before the promise exists.
    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: AggregatesParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IAggregates> {
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
        options: AggregatesParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : IAggregates {
        return this.withTrace({ parameter: Parameter.AGGREGATES, driver }, (issueCollector) => {
            const schema = typeof options.schema === 'undefined' ?
                undefined :
                ResolutionScope.for(this.registry, Parameter.AGGREGATES, options.schema).schema;

            return new Aggregates(buildCallNodes(
                Parameter.AGGREGATES,
                input,
                schema,
                issueCollector,
                (term, lowering) => new Aggregate({
                    name: term.name,
                    params: term.params,
                    lowering,
                }),
            ));
        });
    }
}
