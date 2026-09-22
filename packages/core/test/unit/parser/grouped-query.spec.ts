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
    Schema,
    SchemaRegistry,
    Sort,
    SortDirection,
    Sorts,
    defineSchema,
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
    ParseParameterOptions,
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

    describe('grouped mode', () => {
        it('should not parse fields, so no fields default materializes', () => {
            const parsers = buildParsers();

            const query = new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope' }, { groups: true });

            expect(parsers.fields.calls).toHaveLength(0);
            expect(query.fields).toEqual(new Fields());
        });

        it('should reject client fields', () => {
            const items = issuesOf(() => new StubQueryParser(new SchemaRegistry(), buildParsers())
                .parse({ groups: 'scope', fields: ['id'] }, { groups: true }));

            expect(items).toEqual([expect.objectContaining({
                code: ErrorCode.FEATURE_UNSUPPORTED,
                path: [],
                message: ErrorMessage.featureUnsupported('fields:grouped'),
            })]);
            expect(extractIssueParameter(items[0]!)).toBe(Parameter.FIELDS);
        });

        it('should parse fields as usual when nothing is grouped', () => {
            const parsers = buildParsers({ groups: [], aggregates: [] });

            new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: '', fields: ['id'] }, { groups: true });

            expect(parsers.fields.calls.map((call) => call.input)).toEqual([['id']]);
        });

        it('should parse sorts against the output keys of a bound parse', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'record',
                throwOnFailure: true,
                sorts: { allowed: ['id'], default: { id: 'DESC' } },
            }));
            const parsers = buildParsers();

            new StubQueryParser(registry, parsers).parse(
                {
                    groups: 'scope',
                    aggregates: 'count',
                    sorts: '-count',
                },
                {
                    schema: 'record',
                    groups: true,
                    aggregates: true,
                },
            );

            const options = parsers.sorts.calls[0]?.options as ParseParameterOptions;
            expect(options.schema).toBeInstanceOf(Schema);

            const schema = options.schema as Schema;
            expect(schema.name).toBeUndefined();
            expect(schema.sorts.allowed).toEqual(['scope', 'count']);
            expect(schema.sorts.defaultIsUndefined).toBe(true);
            expect(schema.sorts.throwOnFailure).toBe(true);
            expect(options.relations).toEqual(new Relations());
        });

        it('should bind the output keys in an unbound parse too', () => {
            const parsers = buildParsers();

            new StubQueryParser(new SchemaRegistry(), parsers)
                .parse({ groups: 'scope', sorts: 'age' }, { groups: true });

            const options = parsers.sorts.calls[0]?.options as ParseParameterOptions;
            const schema = options.schema as Schema;
            // aggregates are not flagged, so only the group key is an output key.
            expect(schema.sorts.allowed).toEqual(['scope']);
            expect(schema.sorts.throwOnFailure).toBeUndefined();
            expect(options.relations).toEqual(new Relations());
        });

        it('should hand an ungrouped sorts parse the query options unchanged', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({ name: 'record' }));
            const parsers = buildParsers();

            new StubQueryParser(registry, parsers).parse({ sorts: '-id' }, { schema: 'record' });

            const options = parsers.sorts.calls[0]?.options as ParseParameterOptions;
            expect(options.schema).toBe('record');
            expect(options.relations).toBeUndefined();
        });

        it('should not refill grouped sorts with the schema default when pruning', () => {
            const registry = new SchemaRegistry();
            const schema = defineSchema({
                name: 'record',
                relations: { allowed: ['user'], validate: (name: string) => name !== 'user' },
                sorts: { default: { id: 'DESC' } },
            });
            registry.add(schema);

            const parsers = buildParsers({
                obligation: {
                    key: 'user',
                    path: 'user',
                    schema: schema.relations,
                },
            });

            const query = new StubQueryParser(registry, parsers)
                .parse({ groups: 'scope' }, { schema: 'record', groups: true });

            expect(query.sorts).toEqual(new Sorts());
        });

        it('should not judge output keys by the sorts index policy', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'record',
                indexes: [['id']],
                sorts: { indexed: true, default: { id: 'DESC' } },
            }));

            const parsers = buildParsers({ sorts: [new Sort('count', SortDirection.DESC)] });

            const query = new StubQueryParser(registry, parsers)
                .parse({ groups: 'scope', sorts: '-count' }, { schema: 'record', groups: true });

            expect(query.sorts).toEqual(new Sorts([new Sort('count', SortDirection.DESC)]));
        });

        it('should apply the same rules asynchronously', async () => {
            const parsers = buildParsers();
            const parser = new StubQueryParser(new SchemaRegistry(), parsers);

            await expect(parser.parseAsync({ groups: 'scope', fields: ['id'] }, { groups: true }))
                .rejects.toBeInstanceOf(ParseError);

            await parser.parseAsync({ groups: 'scope', sorts: '-count' }, { groups: true });

            expect(parsers.fields.calls).toHaveLength(0);
            const options = parsers.sorts.calls[1]?.options as ParseParameterOptions;
            expect((options.schema as Schema).sorts.allowed).toEqual(['scope']);
        });
    });
});
