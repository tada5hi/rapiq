/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    Parameter,
    ParseError,
    SchemaRegistry,
    defineSchema,
    extractIssueParameter,
} from '@rapiq/core';
import type { FiltersParseError } from '@rapiq/core';
import { MongoParser } from '../../src';

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
        filters: { allowed: ['id', 'name'] },
        relations: { allowed: ['items'] },
        schemaMapping: { items: 'item' },
    }));

    registry.add(defineSchema<Item>({
        name: 'item',
        filters: { allowed: ['id'] },
    }));

    return registry;
};

describe('src/parameter/filters — issue traces', () => {
    it('should retain a structural abort after an earlier standalone rejection', () => {
        const parser = new MongoParser(buildRegistry(true));

        try {
            parser.parseFilters({ secret: 1, id: { $size: -1 } }, { schema: 'row' });
            expect.fail('expected an aggregated rejection');
        } catch (error) {
            const parsed = error as FiltersParseError;
            expect(parsed.issues.map((issue) => issue.code)).toEqual([
                ErrorCode.KEY_NOT_ALLOWED,
                ErrorCode.KEY_VALUE_INVALID,
            ]);
        }
    });

    it('should silently drop a rejected key under the drop policy', () => {
        const parser = new MongoParser(buildRegistry());

        const output = parser.parseFilters({ secret: 1 }, { schema: 'row' });

        expect(output.value).toEqual([]);
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
