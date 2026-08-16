/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    ErrorMessage,
    FiltersParseError,
    ITSELF,
    Parameter,
    ParseError,
    ResolutionScope,
    SchemaRegistry,
    buildIssue,
    defineSchema,
    extractIssueParameter,
} from '@rapiq/core';
import { MongoFiltersParser, MongoParser } from '../../src';

type Item = { id: string, title: string };
type Row = {
    id: string, 
    name: string, 
    items: Item[] 
};

const buildRegistry = (throwOnFailure?: boolean) => {
    const registry = new SchemaRegistry();

    registry.add(defineSchema<Row>({
        name: 'row',
        throwOnFailure,
        filters: { allowed: ['id', 'name', 'items'] },
        relations: { allowed: ['items'] },
        schemaMapping: { items: 'item' },
    }));

    registry.add(defineSchema<Item>({
        name: 'item',
        filters: { allowed: ['id'] },
    }));

    return registry;
};

class ExposedMongoFiltersParser extends MongoFiltersParser {
    parseFieldEntryForTest(
        key: string,
        value: unknown,
        scope: ResolutionScope<`${Parameter.FILTERS}`>,
    ) {
        return this.parseFieldEntry(key, value, scope, false, 0);
    }
}

describe('src/parameter/filters — issue traces', () => {
    it('should retain a contextual structural abort after an earlier rejection', () => {
        const parser = new MongoParser(buildRegistry(true));
        const filters = { secret: 1, id: { $size: -1 } };

        for (const run of [
            () => parser.parseFilters(filters, { schema: 'row' }),
            () => parser.parse({ filters }, { schema: 'row' }),
        ]) {
            try {
                run();
                expect.fail('expected an aggregated rejection');
            } catch (error) {
                const parsed = error as FiltersParseError;
                const [allowIssue, grammarIssue] = parsed.issues;
                expect(allowIssue?.path).toEqual(['secret']);
                expect(grammarIssue).toMatchObject({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    path: ['id'],
                    received: { $size: -1 },
                });
            }
        }
    });

    it('should contextualize nested dotted structural failures synchronously and asynchronously', async () => {
        const parser = new MongoParser(buildRegistry());
        const offending = { $size: -1 };
        const filters = { items: { $elemMatch: { profile: { id: offending } } } };

        for (const run of [
            () => Promise.resolve().then(() => parser.parseFilters(filters, { schema: 'row' })),
            () => parser.parseFiltersAsync(filters, { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the nested structural rejection');
            } catch (error) {
                expect(error).toBeInstanceOf(FiltersParseError);
                const parsed = error as FiltersParseError;
                expect(parsed.code).toBe(ErrorCode.INPUT_REJECTED);
                expect(parsed.message).toBe(ErrorMessage.inputRejected(1));
                expect(parsed.issues).toHaveLength(1);
                expect(parsed.issues[0]).toMatchObject({
                    code: ErrorCode.KEY_VALUE_INVALID,
                    path: ['items', 'profile', 'id'],
                    received: { $size: -1 },
                });
                expect(parsed.issues[0]?.received).toBe(offending);
            }
        }
    });

    it('should preserve the cause while contextualizing a nested dotted field once', () => {
        const registry = buildRegistry(true);
        const parser = new ExposedMongoFiltersParser(registry);
        const root = ResolutionScope.for(registry, Parameter.FILTERS, 'row');
        const scope = root.descend('items');
        expect(scope).toBeInstanceOf(ResolutionScope);
        if (!(scope instanceof ResolutionScope)) {
            expect.fail('expected the item filter scope');
        }
        const offending = { $size: -1 };

        try {
            parser.parseFieldEntryForTest('profile', { id: offending }, scope);
            expect.fail('expected the nested structural rejection');
        } catch (error) {
            expect(error).toBeInstanceOf(FiltersParseError);
            const parsed = error as FiltersParseError;
            expect(parsed.code).toBe(ErrorCode.KEY_VALUE_INVALID);
            expect(parsed.message).toBe(ErrorMessage.keyValueInvalid('profile.id'));
            expect(parsed.cause).toBeInstanceOf(FiltersParseError);
            expect((parsed.cause as FiltersParseError).code).toBe(ErrorCode.KEY_VALUE_INVALID);
            expect(parsed.issues).toHaveLength(1);
            expect(parsed.issues[0]?.path).toEqual(['items', 'profile', 'id']);
            expect(parsed.issues[0]?.received).toBe(offending);
            expect(parsed.issues[0]?.received).toEqual({ $size: -1 });
        }
    });

    it('should rethrow an already-traced field error by object identity', () => {
        const registry = buildRegistry(true);
        const parser = new ExposedMongoFiltersParser(registry);
        const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'row');
        const received = { $eq: 'bad' };
        const traced = new FiltersParseError({
            code: ErrorCode.KEY_VALUE_INVALID,
            message: ErrorMessage.keyValueInvalid('existing'),
            issues: [buildIssue({
                code: ErrorCode.KEY_VALUE_INVALID,
                parameter: Parameter.FILTERS,
                path: ['existing'],
                message: ErrorMessage.keyValueInvalid('existing'),
                received,
            })],
        });
        const value = {};
        Object.defineProperty(value, '$eq', {
            enumerable: true,
            get: () => {
                throw traced;
            },
        });

        try {
            parser.parseFieldEntryForTest('id', value, scope);
            expect.fail('expected the traced field error');
        } catch (error) {
            expect(error).toBe(traced);
            expect(traced.issues).toHaveLength(1);
            expect(traced.issues[0]?.path).toEqual(['existing']);
            expect(traced.issues[0]?.received).toBe(received);
        }
    });

    it('should report absolute validator paths inside elemMatch synchronously and asynchronously', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            filters: {
                allowed: ['items'],
                throwOnFailure: true,
                validate: (leaf) => (leaf.field === 'id' ? undefined : leaf),
            },
        }));
        const parser = new MongoParser(registry);

        for (const run of [
            () => Promise.resolve().then(() => parser.parseFilters({ items: { $elemMatch: { id: '1' } } }, { schema: 'row' })),
            () => parser.parseFiltersAsync({ items: { $elemMatch: { id: '1' } } }, { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the validator rejection');
            } catch (error) {
                const parsed = error as FiltersParseError;
                expect(parsed.issues[0]?.path).toEqual(['items', 'id']);
                expect(extractIssueParameter(parsed.issues[0]!)).toBe(Parameter.FILTERS);
            }
        }
    });

    it('should not add an ITSELF segment to a Mongo elemMatch validator path', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            filters: {
                allowed: ['items'],
                throwOnFailure: true,
                validate: (leaf) => (leaf.field === ITSELF ? undefined : leaf),
            },
        }));
        const parser = new MongoParser(registry);

        for (const run of [
            () => Promise.resolve().then(() => parser.parseFilters({ items: { $elemMatch: { $eq: '1' } } }, { schema: 'row' })),
            () => parser.parseFiltersAsync({ items: { $elemMatch: { $eq: '1' } } }, { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the validator rejection');
            } catch (error) {
                expect((error as FiltersParseError).issues[0]?.path).toEqual(['items']);
            }
        }
    });

    it('should silently drop a rejected key under the drop policy', () => {
        const parser = new MongoParser(buildRegistry());

        const output = parser.parseFilters({ secret: 1 }, { schema: 'row' });

        expect(output.value).toEqual([]);
    });

    it('should propagate non-parse field-entry errors unchanged', async () => {
        const failure = new Error('Field value failed.');
        const value = {};
        Object.defineProperty(value, '$eq', {
            enumerable: true,
            get: () => {
                throw failure;
            },
        });
        const parser = new MongoParser(buildRegistry());

        for (const run of [
            () => Promise.resolve().then(() => parser.parseFilters({ id: value }, { schema: 'row' })),
            () => parser.parseFiltersAsync({ id: value }, { schema: 'row' }),
        ]) {
            try {
                await run();
                expect.fail('expected the field value error');
            } catch (error) {
                expect(error).toBe(failure);
            }
        }
    });

    it('should report a dropped field key', () => {
        const parser = new MongoParser(buildRegistry(true));

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: { secret: 'x' } }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error?.issues).toEqual([{
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['secret'],
            message: 'The key secret is not permitted.',
            meta: { parameter: Parameter.FILTERS, key: 'secret' },
        }]);
    });

    it('should aggregate dropped keys under a throwing schema', () => {
        const parser = new MongoParser(buildRegistry(true));

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: { $or: [{ secret: 'x' }, { other: 'y' }] } }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error).toBeInstanceOf(ParseError);
        expect((error?.issues ?? []).map((item) => item.path)).toEqual([['secret'], ['other']]);
    });

    it('should keep a grammar error a grammar error', () => {
        const parser = new MongoParser(buildRegistry());

        // grammar failures are policy-independent and abort the parameter;
        // the parse records one issue and raises it.
        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: { id: { $nope: 1 } } }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error?.issues).toHaveLength(1);
        expect(extractIssueParameter(error!.issues[0]!)).toBe(Parameter.FILTERS);
    });

    it('should carry the trace on a standalone grammar abort', () => {
        const parser = new MongoParser(buildRegistry());

        let error : FiltersParseError | undefined;
        try {
            parser.parseFilters('not-a-document', { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        // rendering a failure reads error.issues, so a grammar abort has to
        // populate it too
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.code).toBe(ErrorCode.INPUT_INVALID);
    });

    it('should leave a legal elemMatch on a non-relation field alone', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            throwOnFailure: true,
            filters: { allowed: ['tags'] },
        }));

        const parser = new MongoParser(registry);

        // an array of scalars is not a relation: "no schema for this key" is
        // an answer here, not a violation, so nothing is recorded and the
        // parse does not fail.
        const query = parser.parse({ filters: { tags: { $elemMatch: { $eq: 'x' } } } }, { schema: 'row' });

        expect(query.filters.value).toHaveLength(1);
    });

    it('should report an elemMatch interior key the related schema rejects', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<Row>({
            name: 'row',
            filters: { allowed: ['id', 'items'] },
            schemaMapping: { items: 'item' },
        }));
        registry.add(defineSchema<Item>({
            name: 'item',
            filters: { allowed: ['id'] },
        }));

        const parser = new MongoParser(registry);

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: { items: { $elemMatch: { secret: '1' } } } }, { schema: 'row', throwOnFailure: true });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(extractIssueParameter(error!.issues[0]!)).toBe(Parameter.FILTERS);
        expect(error?.issues[0]).toMatchObject({
            code: ErrorCode.KEY_NOT_ALLOWED,
            // the interior is addressed relative to the element, but the
            // canonical position keeps the relation it hangs off
            path: ['items', 'secret'],
        });
    });
});
