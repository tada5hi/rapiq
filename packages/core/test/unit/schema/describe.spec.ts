/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Parameter,
    defineSchema,
} from '../../../src';
import type { User } from '../../data/type';

describe('src/schema/**/describe', () => {
    it('should serialize every declared constraint', () => {
        const schema = defineSchema<User>({
            name: 'user',
            fields: {
                default: ['id', 'name'],
                allowed: ['email'],
            },
            filters: { allowed: ['id', 'name'] },
            relations: { allowed: ['realm', 'items'] },
            sort: {
                allowed: ['id', 'name'],
                default: { name: 'DESC' },
            },
            pagination: { maxLimit: 50 },
            schemaMapping: { items: 'item' },
        });

        expect(schema.describe()).toEqual({
            name: 'user',
            strict: false,
            indexes: null,
            fields: {
                default: ['id', 'name'],
                allowed: ['email'],
            },
            filters: {
                allowed: ['id', 'name'], 
                caseSensitive: null, 
                indexed: false, 
            },
            pagination: { maxLimit: 50 },
            relations: {
                allowed: ['realm', 'items'],
                schemas: {
                    realm: 'realm',
                    items: 'item',
                },
            },
            sorts: {
                allowed: ['id', 'name'],
                default: { name: 'DESC' },
                indexed: false,
            },
        });
    });

    it('should keep the shape uniform: undeclared constraints serialize as null', () => {
        const schema = defineSchema<User>({});

        expect(schema.describe()).toEqual({
            name: null,
            strict: false,
            indexes: null,
            fields: { default: null, allowed: null },
            filters: {
                allowed: null, 
                caseSensitive: null, 
                indexed: false, 
            },
            pagination: { maxLimit: null },
            relations: { allowed: null, schemas: null },
            sorts: {
                allowed: null,
                default: null,
                indexed: false,
            },
        });
    });

    it('should keep an explicitly empty allow-list distinguishable from an undeclared one', () => {
        const schema = defineSchema<User>({
            fields: { allowed: [] },
            relations: { allowed: [] },
            filters: { caseSensitive: [] },
        });

        const output = schema.describe();

        expect(output.fields).toEqual({ default: null, allowed: [] });
        expect(output.relations).toEqual({ allowed: [], schemas: {} });
        expect(output.filters).toEqual({
            allowed: null, 
            caseSensitive: [], 
            indexed: false, 
        });
    });

    it('should restrict the description to the selected parameters', () => {
        const schema = defineSchema<User>({
            name: 'user',
            fields: { allowed: ['id', 'name'] },
            filters: { allowed: ['id'] },
            relations: { allowed: ['realm'] },
            sort: { allowed: ['id'] },
            pagination: { maxLimit: 50 },
        });

        expect(schema.describe({ parameters: [Parameter.FIELDS, Parameter.RELATIONS] })).toEqual({
            name: 'user',
            strict: false,
            indexes: null,
            fields: { default: null, allowed: ['id', 'name'] },
            relations: {
                allowed: ['realm'],
                schemas: { realm: 'realm' },
            },
        });
    });

    it('should serialize the declared caseSensitive list', () => {
        const schema = defineSchema<User>({ filters: { allowed: ['id', 'name'], caseSensitive: ['name'] } });

        expect(schema.describe().filters).toEqual({
            allowed: ['id', 'name'],
            caseSensitive: ['name'],
            indexed: false,
        });
    });

    it('should not expose the caseSensitive list to description mutations', () => {
        const schema = defineSchema<User>({ filters: { allowed: ['id'], caseSensitive: ['id'] } });

        const output = schema.describe();
        output.filters!.caseSensitive!.push('mutated');

        expect(schema.filters.caseSensitive).toEqual(['id']);
    });

    it('should serialize a sort allow-list derived from default keys', () => {
        const schema = defineSchema<User>({ sort: { default: { name: 'DESC' } } });

        expect(schema.describe().sorts).toEqual({
            allowed: ['name'],
            default: { name: 'DESC' },
            indexed: false,
        });
    });

    it('should clone the sort allow-list', () => {
        const schema = defineSchema<User>({ sort: { allowed: ['realm.id', 'id'] } });

        const output = schema.describe();

        expect(output.sorts).toEqual({
            allowed: ['realm.id', 'id'],
            default: null,
            indexed: false,
        });

        (output.sorts!.allowed as string[]).push('mutated');
        expect(schema.sort.allowed).toEqual(['realm.id', 'id']);
    });

    it('should not expose internal state to description mutations', () => {
        const schema = defineSchema<User>({
            fields: { default: ['id'], allowed: ['email'] },
            filters: { allowed: ['id'] },
            relations: { allowed: ['realm'] },
            sort: { default: { name: 'DESC' } },
        });

        const output = schema.describe();

        output.fields!.default!.push('mutated');
        output.fields!.allowed!.push('mutated');
        output.filters!.allowed!.push('mutated');
        output.relations!.allowed!.push('mutated');
        output.sorts!.default!.id = 'ASC';

        expect(schema.fields.default).toEqual(['id']);
        expect(schema.fields.allowed).toEqual(['email']);
        expect(schema.filters.allowed).toEqual(['id']);
        expect(schema.relations.allowed).toEqual(['realm']);
        expect(schema.sort.default).toEqual({ name: 'DESC' });
    });

    it('should normalize the strict flag to its effective default', () => {
        expect(defineSchema<User>({}).describe().strict).toBe(false);
        expect(defineSchema<User>({ strict: true }).describe().strict).toBe(true);
    });

    it('should survive a JSON round-trip unchanged', () => {
        const schema = defineSchema<User>({
            name: 'user',
            fields: { default: ['id', 'name'], allowed: ['email'] },
            filters: { allowed: ['id', 'name'] },
            relations: { allowed: ['realm'] },
            sort: { allowed: ['id'], default: { id: 'ASC' } },
            pagination: { maxLimit: 50 },
        });

        const output = schema.describe();

        expect(JSON.parse(JSON.stringify(output))).toEqual(output);
    });
});
