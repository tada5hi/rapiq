/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// sub-parser stubs drive the orchestrator under test.
/* eslint-disable max-classes-per-file */

import { flattenIssueItems } from '@ebec/core';
import type { IssueItem } from '@ebec/core';
import {
    Aggregate,
    Aggregates,
    BaseQueryParser,
    ErrorCode,
    ErrorMessage,
    Fields,
    FilterCompoundOperator,
    Filters,
    Group,
    Groups,
    Pagination,
    Parameter,
    ParseError,
    Relations,
    SchemaRegistry,
    Sorts,
    extractIssueParameter,
} from '../../../src';
import type {
    IAggregates,
    IFields,
    IFilters,
    IGroups,
    IPagination,
    IQueryParameterParser,
    IRelations,
    ISort,
    ISorts,
    PendingKeyValidation,
    RelationLedger,
} from '../../../src';

/**
 * A sub-parser stub: remembers what the orchestrator handed it and returns a
 * fixed node, optionally recording one relation obligation.
 */
class StubParameterParser<T> implements IQueryParameterParser<T> {
    readonly calls : { input: unknown, options: unknown }[] = [];

    constructor(
        private readonly node: T,
        private readonly obligation?: PendingKeyValidation,
    ) {}

    parse() : T {
        return this.node;
    }

    parseAsync() : Promise<T> {
        return Promise.resolve(this.node);
    }

    parseParameter(input: unknown, options: unknown, ledger: RelationLedger) : T {
        this.calls.push({ input, options });
        if (this.obligation) {
            ledger.push(this.obligation);
        }

        return this.node;
    }

    parseParameterAsync(input: unknown, options: unknown, ledger: RelationLedger) : Promise<T> {
        return Promise.resolve(this.parseParameter(input, options, ledger));
    }
}

type StubParsers = {
    fields: StubParameterParser<IFields>,
    filters: StubParameterParser<IFilters>,
    pagination: StubParameterParser<IPagination>,
    relations: StubParameterParser<IRelations>,
    sorts: StubParameterParser<ISorts>,
    groups?: StubParameterParser<IGroups>,
    aggregates?: StubParameterParser<IAggregates>,
};

class StubQueryParser extends BaseQueryParser {
    protected fieldsParser : IQueryParameterParser<IFields>;

    protected filtersParser : IQueryParameterParser<IFilters>;

    protected paginationParser : IQueryParameterParser<IPagination>;

    protected relationsParser : IQueryParameterParser<IRelations>;

    protected sortParser : IQueryParameterParser<ISorts>;

    constructor(registry: SchemaRegistry, parsers: StubParsers) {
        super(registry);
        this.fieldsParser = parsers.fields;
        this.filtersParser = parsers.filters;
        this.paginationParser = parsers.pagination;
        this.relationsParser = parsers.relations;
        this.sortParser = parsers.sorts;
        this.groupsParser = parsers.groups;
        this.aggregatesParser = parsers.aggregates;
    }
}

const SCOPE = new Group({
    name: 'scope',
    lowering: {
        fn: undefined, 
        field: 'scope', 
        args: [], 
    }, 
});
const COUNT = new Aggregate({
    name: 'count',
    lowering: {
        fn: 'count', 
        field: undefined, 
        args: [], 
    }, 
});

function buildParsers(input: {
    groups?: Group[],
    aggregates?: Aggregate[],
    sorts?: ISort[],
    obligation?: PendingKeyValidation,
} = {}) : Required<StubParsers> {
    return {
        fields: new StubParameterParser<IFields>(new Fields()),
        filters: new StubParameterParser<IFilters>(new Filters(FilterCompoundOperator.AND, [])),
        pagination: new StubParameterParser<IPagination>(new Pagination()),
        relations: new StubParameterParser<IRelations>(new Relations(), input.obligation),
        sorts: new StubParameterParser<ISorts>(new Sorts(input.sorts ?? [])),
        groups: new StubParameterParser<IGroups>(new Groups(input.groups ?? [SCOPE])),
        aggregates: new StubParameterParser<IAggregates>(new Aggregates(input.aggregates ?? [COUNT])),
    };
}

/**
 * The leaves of the trace a parse raised, or [] when it raised nothing.
 */
function issuesOf(run: () => unknown) : IssueItem[] {
    try {
        run();
    } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).code).toBe(ErrorCode.INPUT_REJECTED);

        return flattenIssueItems((e as ParseError).issues);
    }

    return [];
}

describe('src/parser/query.ts (groups and aggregates)', () => {
    describe('opt-in', () => {
        it('should ignore both parameters unless the parse opts in', () => {
            const parsers = buildParsers();

            const query = new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope', aggregates: 'count' });

            expect(parsers.groups.calls).toHaveLength(0);
            expect(parsers.aggregates.calls).toHaveLength(0);
            expect(query.groups).toEqual(new Groups());
            expect(query.aggregates).toEqual(new Aggregates());
        });

        it('should parse a parameter flagged true', () => {
            const parsers = buildParsers();

            const query = new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope', aggregates: 'count' }, { groups: true });

            expect(parsers.groups.calls.map((call) => call.input)).toEqual(['scope']);
            expect(parsers.aggregates.calls).toHaveLength(0);
            expect(query.groups.value).toEqual([SCOPE]);
        });

        it('should parse a parameter listed in parameters', () => {
            const parsers = buildParsers();

            const query = new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope', aggregates: 'count' }, { parameters: ['aggregates'] });

            expect(parsers.groups.calls).toHaveLength(0);
            expect(parsers.aggregates.calls.map((call) => call.input)).toEqual(['count']);
            expect(query.aggregates.value).toEqual([COUNT]);
        });

        it('should let a false flag win over the parameters list', () => {
            const parsers = buildParsers();

            new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope' }, { parameters: ['groups'], groups: false });

            expect(parsers.groups.calls).toHaveLength(0);
        });

        it('should not run the sub-parser when the client sent nothing', () => {
            const parsers = buildParsers();

            const query = new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({}, { groups: true, aggregates: true });

            expect(parsers.groups.calls).toHaveLength(0);
            expect(parsers.aggregates.calls).toHaveLength(0);
            expect(query.groups).toEqual(new Groups());
        });

        it('should parse the same way asynchronously', async () => {
            const parsers = buildParsers();

            const query = await new StubQueryParser(new SchemaRegistry(), parsers)
                .parseAsync({ groups: 'scope', aggregates: 'count' }, { groups: true });

            expect(parsers.groups.calls).toHaveLength(1);
            expect(parsers.aggregates.calls).toHaveLength(0);
            expect(query.groups.value).toEqual([SCOPE]);
        });
    });

    describe('a dialect without a sub-parser', () => {
        it('should reject opted-in input it cannot parse', () => {
            const parser = new StubQueryParser(new SchemaRegistry(), { ...buildParsers(), groups: undefined });

            const items = issuesOf(() => parser.parse({ groups: 'scope' }, { groups: true }));

            expect(items).toEqual([expect.objectContaining({
                code: ErrorCode.FEATURE_UNSUPPORTED,
                path: [],
                message: ErrorMessage.featureUnsupported(Parameter.GROUPS),
            })]);
            expect(extractIssueParameter(items[0]!)).toBe(Parameter.GROUPS);
        });

        it('should reject it asynchronously too', async () => {
            const parser = new StubQueryParser(new SchemaRegistry(), { ...buildParsers(), aggregates: undefined });

            await expect(parser.parseAsync({ aggregates: 'count' }, { aggregates: true }))
                .rejects.toBeInstanceOf(ParseError);
        });

        it('should stay silent when the client sent nothing', () => {
            const parser = new StubQueryParser(new SchemaRegistry(), { ...buildParsers(), groups: undefined });

            expect(issuesOf(() => parser.parse({}, { groups: true }))).toEqual([]);
        });
    });

    describe('output keys', () => {
        it('should reject an aggregate key equal to a group key', () => {
            const parsers = buildParsers({
                groups: [new Group({
                    name: 'count',
                    lowering: {
                        fn: undefined, 
                        field: 'count', 
                        args: [], 
                    }, 
                })],
                aggregates: [COUNT],
            });

            const items = issuesOf(() => new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'count', aggregates: 'count' }, { groups: true, aggregates: true }));

            expect(items).toEqual([expect.objectContaining({
                code: ErrorCode.KEY_AMBIGUOUS,
                path: ['count'],
                message: ErrorMessage.outputKeyDuplicate('count'),
            })]);
            expect(extractIssueParameter(items[0]!)).toBe(Parameter.AGGREGATES);
        });
    });
});
