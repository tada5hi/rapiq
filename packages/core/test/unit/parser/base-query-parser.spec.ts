/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// two small sub-parser stubs drive the orchestrator under test.
/* eslint-disable max-classes-per-file */

import {
    BaseQueryParser,
    ErrorCode,
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Pagination,
    Relation,
    Relations,
    RelationsParseError,
    SchemaRegistry,
    Sort,
    SortDirection,
    Sorts,
    defineSchema,
} from '../../../src';
import type {
    IFields,
    IFilters,
    IPagination,
    IQueryParameterParser,
    IRelations,
    ISorts,
    PendingKeyValidation,
    RelationLedger,
    RelationsSchema,
} from '../../../src';

type Actor = { permissions: string[] };

const actor : Actor = { permissions: ['realm_read'] };

/**
 * A sub-parser stub: records a fixed obligation into whatever ledger the query
 * orchestrator hands it, and returns a fixed node — enough to exercise
 * `BaseQueryParser`'s pooling, single-pass dedup and cross-parameter pruning
 * without a dialect.
 */
class StubParameterParser<T> implements IQueryParameterParser<T> {
    readonly ledgers : RelationLedger[] = [];

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

    parseParameter(_input: unknown, _options: unknown, ledger: RelationLedger) : T {
        this.ledgers.push(ledger);
        if (this.obligation) {
            ledger.push(this.obligation);
        }

        return this.node;
    }

    parseParameterAsync(input: unknown, options: unknown, ledger: RelationLedger) : Promise<T> {
        return Promise.resolve(this.parseParameter(input, options, ledger));
    }
}

class StubQueryParser extends BaseQueryParser {
    protected fieldsParser : IQueryParameterParser<IFields>;

    protected filtersParser : IQueryParameterParser<IFilters>;

    protected paginationParser : IQueryParameterParser<IPagination>;

    protected relationsParser : IQueryParameterParser<IRelations>;

    protected sortParser : IQueryParameterParser<ISorts>;

    constructor(
        registry: SchemaRegistry,
        parsers: {
            fields: IQueryParameterParser<IFields>,
            filters: IQueryParameterParser<IFilters>,
            pagination: IQueryParameterParser<IPagination>,
            relations: IQueryParameterParser<IRelations>,
            sort: IQueryParameterParser<ISorts>,
        },
    ) {
        super(registry);
        this.fieldsParser = parsers.fields;
        this.filtersParser = parsers.filters;
        this.paginationParser = parsers.pagination;
        this.relationsParser = parsers.relations;
        this.sortParser = parsers.sort;
    }
}

function buildRegistry(
    validate: (name: string, context: Actor) => boolean | undefined | Promise<boolean | undefined>,
    throwOnFailure = false,
) : { registry: SchemaRegistry, relations: RelationsSchema } {
    const registry = new SchemaRegistry();
    const schema = defineSchema<Record<string, any>, Actor>({
        name: 'record',
        throwOnFailure,
        relations: { allowed: ['user', 'realm'], validate },
    });
    registry.add(schema);

    return { registry, relations: schema.relations };
}

function buildParsers(obligation: PendingKeyValidation) {
    return {
        fields: new StubParameterParser<IFields>(
            new Fields([new Field('user.email'), new Field('id')]),
            obligation,
        ),
        filters: new StubParameterParser<IFilters>(
            new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'user.name', 'x'),
                new Filter(FilterFieldOperator.EQUAL, 'id', 'x'),
            ]),
            obligation,
        ),
        pagination: new StubParameterParser<IPagination>(new Pagination()),
        relations: new StubParameterParser<IRelations>(
            new Relations([new Relation('user'), new Relation('realm')]),
            obligation,
        ),
        sort: new StubParameterParser<ISorts>(new Sorts([new Sort('id', SortDirection.ASC)])),
    };
}

const INPUT = {
    relations: [], 
    fields: {}, 
    filters: {}, 
    pagination: {}, 
    sort: [],
};

describe('src/parser/query.ts (BaseQueryParser orchestration)', () => {
    it('pools obligations from every parameter into one shared ledger', () => {
        const validate = vi.fn(() => true);
        const { registry, relations } = buildRegistry(validate);
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        new StubQueryParser(registry, parsers).parse(INPUT, { schema: 'record', context: actor });

        // relations, fields and filters each received the SAME ledger instance.
        const ledger = (parsers.relations as StubParameterParser<IRelations>).ledgers[0];
        expect((parsers.fields as StubParameterParser<IFields>).ledgers[0]).toBe(ledger);
        expect((parsers.filters as StubParameterParser<IFilters>).ledgers[0]).toBe(ledger);
    });

    it('runs the relations hook once per distinct relation and prunes it everywhere', () => {
        const validate = vi.fn((name: string) => name !== 'user');
        const { registry, relations } = buildRegistry(validate);
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        const query = new StubQueryParser(registry, parsers).parse(INPUT, { schema: 'record', context: actor });

        // three parameters referenced `user` — the hook fired exactly once.
        expect(validate.mock.calls.filter(([n]) => n === 'user')).toHaveLength(1);

        expect(query.relations.value.map((r) => r.name)).toEqual(['realm']);
        expect(query.fields.value.map((f) => f.name)).toEqual(['id']);
        expect(query.filters.value.map((c) => (c as Filter).field)).toEqual(['id']);
        expect(query.sorts.value.map((s) => s.name)).toEqual(['id']);
    });

    it('keeps everything when the hook accepts the relation', () => {
        const validate = vi.fn(() => true);
        const { registry, relations } = buildRegistry(validate);
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        const query = new StubQueryParser(registry, parsers).parse(INPUT, { schema: 'record', context: actor });

        expect(query.relations.value.map((r) => r.name)).toEqual(['user', 'realm']);
        expect(query.fields.value.map((f) => f.name)).toEqual(['user.email', 'id']);
    });

    it('throws RelationsParseError under the relations schema throwOnFailure', () => {
        const { registry, relations } = buildRegistry(() => false, true);
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        expect.assertions(2);
        try {
            new StubQueryParser(registry, parsers).parse(INPUT, { schema: 'record', context: actor });
        } catch (e) {
            expect(e).toBeInstanceOf(RelationsParseError);
            expect((e as RelationsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
        }
    });

    it('awaits an async hook and prunes on parseAsync', async () => {
        const validate = vi.fn(async (name: string) => name !== 'user');
        const { registry, relations } = buildRegistry(validate);
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        const query = await new StubQueryParser(registry, parsers).parseAsync(INPUT, { schema: 'record', context: actor });

        expect(query.relations.value.map((r) => r.name)).toEqual(['realm']);
        expect(query.fields.value.map((f) => f.name)).toEqual(['id']);
    });

    it('records nothing to authorize without a schema', () => {
        const validate = vi.fn(() => false);
        const { relations } = buildRegistry(validate);
        const registry = new SchemaRegistry();
        const parsers = buildParsers({
            key: 'user', 
            path: 'user', 
            schema: relations, 
        });

        // no schema on the options — the pooled ledger is never evaluated.
        const query = new StubQueryParser(registry, parsers).parse(INPUT, {});

        expect(validate).not.toHaveBeenCalled();
        expect(query.fields.value.map((f) => f.name)).toEqual(['user.email', 'id']);
    });
});
