/*
 * Copyright (c) 2022-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseParser,
    ErrorCode,
    ErrorMessage,
    Pagination,
    Parameter,
    ResolutionScope,
    isObject,
} from '@rapiq/core';
import type {
    IIssueCollector,
    IPagination,
    ObjectLiteral,
    PaginationParseOptions,
    PaginationSchema,
    RelationLedger,
} from '@rapiq/core';

export class SimplePaginationParser<
    OPTIONS extends PaginationParseOptions = PaginationParseOptions,
> extends BaseParser<OPTIONS, IPagination> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD> = {},
    ) : IPagination {
        return this.build(input, options);
    }

    override async parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD> = {},
    ) : Promise<IPagination> {
        return this.build(input, options);
    }

    // pagination traverses no relations, so the ledger is unused.
    parseParameter<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : IPagination {
        return this.build(input, options, issueCollector);
    }

    // `async`, not a wrapped return: `build` raises synchronously, so without
    // it the throw escapes before the promise exists and a caller's
    // `.catch()` never sees it.
    async parseParameterAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD>,
        _ledger?: RelationLedger,
        issueCollector?: IIssueCollector,
    ) : Promise<IPagination> {
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
        options: PaginationParseOptions<RECORD>,
        driver?: IIssueCollector,
    ) : IPagination {
        return this.withTrace({ parameter: Parameter.PAGINATION, driver }, (issueCollector) => this.run(input, options, issueCollector));
    }

    protected run<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input: unknown,
        options: PaginationParseOptions<RECORD>,
        issueCollector: IIssueCollector,
    ) : IPagination {
        const scope = ResolutionScope.for(this.registry, Parameter.PAGINATION, options.schema, {
            throwOnFailure: options.throwOnFailure,
            issueCollector,
        });

        const { schema } = scope;

        const output = new Pagination();

        if (!isObject(input)) {
            // absent input is not a failure — schema constraints
            // (e.g. maxLimit) still apply.
            if (
                typeof input !== 'undefined' &&
                input !== null
            ) {
                scope.refuse({
                    code: ErrorCode.INPUT_INVALID,
                    message: ErrorMessage.inputInvalid(),
                    input,
                });
            }

            return this.finalizePagination(output, schema, scope);
        }

        // pagination performs no key grouping, so the prototype-member
        // guard the grouping helpers apply elsewhere runs explicitly —
        // a hostile key is rejected typed, not ignored.
        this.assertSafeObjectKeys(input);

        const source = input as Record<string, any>;
        let { limit, offset } = source;

        if (typeof limit !== 'undefined') {
            limit = Number.parseInt(limit, 10);

            if (!Number.isNaN(limit) && limit > 0) {
                output.limit = limit;
            } else {
                scope.refuse({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    message: ErrorMessage.keyValueInvalid('limit'),
                    path: ['limit'],
                    input: source.limit,
                });
            }
        }

        if (typeof offset !== 'undefined') {
            offset = Number.parseInt(offset, 10);

            if (!Number.isNaN(offset) && offset >= 0) {
                output.offset = offset;
            } else {
                scope.refuse({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    message: ErrorMessage.keyValueInvalid('offset'),
                    path: ['offset'],
                    input: source.offset,
                });
            }
        }

        return this.finalizePagination(output, schema, scope);
    }

    protected finalizePagination<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        data: Pagination,
        schema: PaginationSchema,
        scope: ResolutionScope<`${Parameter.PAGINATION}`, RECORD>,
    ) : Pagination {
        if (typeof schema.maxLimit !== 'undefined') {
            if (typeof data.limit === 'undefined') {
                data.limit = schema.maxLimit;
            } else if (data.limit > schema.maxLimit) {
                // a clamped limit reads exactly like an honored one on the
                // way out, so the trace is the only way to tell them apart.
                scope.refuse({
                    code: ErrorCode.LIMIT_EXCEEDED,
                    message: ErrorMessage.limitExceeded(schema.maxLimit),
                    path: ['limit'],
                    input: data.limit,
                });

                data.limit = schema.maxLimit;
            }
        }

        if (
            typeof data.limit !== 'undefined' &&
            typeof data.offset === 'undefined'
        ) {
            data.offset = 0;
        }

        return data;
    }
}
