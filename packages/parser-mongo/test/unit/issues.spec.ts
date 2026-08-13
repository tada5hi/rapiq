/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FiltersParseError,
    Parameter,
    SchemaRegistry,
    defineSchema,
} from '@rapiq/core';
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
    it('should report a dropped field key', () => {
        const parser = new MongoParser(buildRegistry(true));

        let error : FiltersParseError | undefined;
        try {
            parser.parse({ filters: { secret: 'x' } }, { schema: 'row' });
        } catch (e) {
            error = e as FiltersParseError;
        }

        expect(error?.issues).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FILTERS,
            path: ['secret'],
            key: 'secret',
            message: 'The key secret is not permitted.',
            severity: 'error',
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

        expect(error).toBeInstanceOf(FiltersParseError);
        expect((error?.issues ?? []).map((item) => item.path)).toEqual([['secret'], ['other']]);
        expect((error?.issues ?? []).every((item) => item.severity === 'error')).toBeTruthy();
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
        expect(error?.issues[0]?.severity).toBe('error');
        expect(error?.issues[0]?.parameter).toBe(Parameter.FILTERS);
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
        expect(error?.code).toBe(ErrorCode.INPUT_INVALID);
        expect(error?.issues).toHaveLength(1);
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

        expect(error?.issues[0]).toMatchObject({
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FILTERS,
            // the interior is addressed relative to the element, but the
            // canonical position keeps the relation it hangs off
            path: ['items', 'secret'],
            severity: 'error',
        });
    });
});
