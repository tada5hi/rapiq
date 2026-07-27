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
            fields: {
                default: ['id', 'name'],
                allowed: ['email'],
            },
            filters: { allowed: ['id', 'name'] },
            pagination: { maxLimit: 50 },
            relations: {
                allowed: ['realm', 'items'],
                schemas: {
                    realm: 'realm',
                    items: 'item',
                },
            },
            sort: {
                allowed: ['id', 'name'],
                default: { name: 'DESC' },
            },
        });
    });

    it('should keep the shape uniform: undeclared constraints serialize as null', () => {
        const schema = defineSchema<User>({});

        expect(schema.describe()).toEqual({
            name: null,
            strict: false,
            fields: { default: null, allowed: null },
            filters: { allowed: null },
            pagination: { maxLimit: null },
            relations: { allowed: null, schemas: null },
            sort: { allowed: null, default: null },
        });
    });

    it('should keep an explicitly empty allow-list distinguishable from an undeclared one', () => {
        const schema = defineSchema<User>({
            fields: { allowed: [] },
            relations: { allowed: [] },
        });

        const output = schema.describe();

        expect(output.fields).toEqual({ default: null, allowed: [] });
        expect(output.relations).toEqual({ allowed: [], schemas: {} });
        expect(output.filters).toEqual({ allowed: null });
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
            fields: { default: null, allowed: ['id', 'name'] },
            relations: {
                allowed: ['realm'],
                schemas: { realm: 'realm' },
            },
        });
    });

    it('should serialize a sort allow-list derived from default keys', () => {
        const schema = defineSchema<User>({ sort: { default: { name: 'DESC' } } });

        expect(schema.describe().sort).toEqual({
            allowed: ['name'],
            default: { name: 'DESC' },
        });
    });

    it('should clone sort tuple groups', () => {
        const schema = defineSchema<User>({ sort: { allowed: [['realm.id', 'id'], ['name']] } });

        const output = schema.describe();

        expect(output.sort).toEqual({ allowed: [['realm.id', 'id'], ['name']], default: null });

        (output.sort!.allowed as string[][])[0].push('mutated');
        expect(schema.sort.allowed[0]).toEqual(['realm.id', 'id']);
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
        output.sort!.default!.id = 'ASC';

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
