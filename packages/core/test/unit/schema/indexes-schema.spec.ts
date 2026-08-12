/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineSchema } from '../../../src';

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    email: string,
    flag: boolean,
};

describe('src/schema/indexes/*.ts', () => {
    it('should normalize the indexes declaration and propagate it', () => {
        const schema = defineSchema<Row>({
            indexes: [['realm_id', 'created_at'], ['email']],
            filters: { indexed: true },
            sort: { indexed: true },
        });

        expect(schema.indexesIsUndefined).toBe(false);
        expect(schema.indexes).toEqual([['realm_id', 'created_at'], ['email']]);
        expect(schema.filters.indexes).toEqual([['realm_id', 'created_at'], ['email']]);
        expect(schema.filters.indexed).toBe('anchor');
        expect(schema.sort.indexes).toEqual([['realm_id', 'created_at'], ['email']]);
        expect(schema.sort.indexed).toBe(true);
    });

    it('should normalize indexed modes', () => {
        const schema = defineSchema<Row>({
            indexes: [['realm_id']],
            filters: { indexed: 'cover' },
        });

        expect(schema.filters.indexed).toBe('cover');
        expect(schema.sort.indexed).toBe(false);
    });

    it('should stay inert without a declaration', () => {
        const schema = defineSchema<Row>({});

        expect(schema.indexesIsUndefined).toBe(true);
        expect(schema.indexes).toEqual([]);
        expect(schema.filters.indexed).toBe(false);
        expect(schema.filters.indexesIsUndefined).toBe(true);
        expect(schema.sort.indexed).toBe(false);
    });

    it('should describe indexes and indexed flags', () => {
        const schema = defineSchema<Row>({
            indexes: [['realm_id', 'created_at']],
            filters: { indexed: 'cover' },
            sort: { indexed: true },
        });

        const output = schema.describe();
        expect(output.indexes).toEqual([['realm_id', 'created_at']]);
        expect(output.filters!.indexed).toBe('cover');
        expect(output.sorts!.indexed).toBe(true);

        // the description is a copy: mutating it never touches the schema.
        output.indexes![0]!.push('mutated');
        expect(schema.indexes[0]).toEqual(['realm_id', 'created_at']);

        const bare = defineSchema<Row>({}).describe();
        expect(bare.indexes).toBeNull();
        expect(bare.filters!.indexed).toBe(false);
        expect(bare.sorts!.indexed).toBe(false);
    });
});
