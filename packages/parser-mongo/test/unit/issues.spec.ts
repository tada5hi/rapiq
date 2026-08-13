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
import type { Issue } from '@rapiq/core';
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
        const parser = new MongoParser(buildRegistry());
        const issues : Issue[] = [];

        const query = parser.parse({ filters: { secret: 'x' } }, { schema: 'row', issues });

        expect(query.filters.value).toHaveLength(0);
        expect(issues).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FILTERS,
            path: ['secret'],
            key: 'secret',
            message: 'The key secret is not permitted.',
            severity: 'warning',
        }]);
    });

    it('should aggregate dropped keys under a throwing schema', () => {
        const parser = new MongoParser(buildRegistry(true));
        const issues : Issue[] = [];

        expect(() => parser.parse({ filters: { $or: [{ secret: 'x' }, { other: 'y' }] } }, { schema: 'row', issues })).toThrow(FiltersParseError);

        expect(issues.map((item) => item.path)).toEqual([['secret'], ['other']]);
        expect(issues.every((item) => item.severity === 'error')).toBeTruthy();
    });

    it('should keep a grammar error a grammar error', () => {
        const parser = new MongoParser(buildRegistry());
        const issues : Issue[] = [];

        // grammar failures are policy-independent and abort the parameter;
        // the query parse records one issue and raises it.
        expect(() => parser.parse({ filters: { id: { $nope: 1 } } }, { schema: 'row', issues }))
            .toThrow(FiltersParseError);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.severity).toBe('error');
        expect(issues[0]?.parameter).toBe(Parameter.FILTERS);
    });

    it('should leave a legal elemMatch on a non-relation field alone', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'row',
            throwOnFailure: true,
            filters: { allowed: ['tags'] },
        }));

        const parser = new MongoParser(registry);
        const issues : Issue[] = [];

        // an array of scalars is not a relation: "no schema for this key" is
        // an answer here, not a violation, so nothing is recorded and the
        // parse does not fail.
        const query = parser.parse({ filters: { tags: { $elemMatch: { $eq: 'x' } } } }, { schema: 'row', issues });

        expect(query.filters.value).toHaveLength(1);
        expect(issues).toEqual([]);
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
        const issues : Issue[] = [];

        const query = parser.parse({ filters: { items: { $elemMatch: { secret: '1' } } } }, { schema: 'row', issues });

        // the emptied interior drops the whole entry
        expect(query.filters.value).toHaveLength(0);
        expect(issues[0]).toMatchObject({
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FILTERS,
            // the interior is addressed relative to the element, but the
            // canonical position keeps the relation it hangs off
            path: ['items', 'secret'],
            severity: 'warning',
        });
    });
});
