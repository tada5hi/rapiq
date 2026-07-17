/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IFilter } from '../../../src';
import {
    BuildError,
    ErrorCode,
    FieldOperator,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    ITSELF,
    SortDirection,
    defineFields,
    defineFilters,
    definePagination,
    defineQuery,
    defineRelations,
    defineSorts,
    elemMatch,
    eq,
    gte,
    or,
} from '../../../src';
import type { User } from '../../data';

const leafs = (filters: { value: unknown[] }) => filters.value as IFilter[];

describe('src/build/parameter/filters/*.ts', () => {
    it('should desugar a scalar to an eq condition', () => {
        const output = defineFilters<User>({ name: 'John' });

        expect(output.operator).toBe(FilterCompoundOperator.AND);
        expect(leafs(output)).toHaveLength(1);
        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.EQUAL,
            field: 'name',
            value: 'John',
        });
    });

    it('should desugar null to an eq condition', () => {
        const output = defineFilters<User>({ email: null });

        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.EQUAL,
            field: 'email',
            value: null,
        });
    });

    it('should desugar a bare array to one in condition with null as legal element', () => {
        const output = defineFilters<User>({ 'realm.id': [1, null] });

        expect(leafs(output)).toHaveLength(1);
        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.IN,
            field: 'realm.id',
            value: [1, null],
        });
    });

    it('should desugar operator objects', () => {
        const output = defineFilters<User>({
            age: { $gte: 18, $lt: 65 },
            name: { $contains: 'oh' },
        });

        expect(leafs(output)).toHaveLength(3);
        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.GREATER_THAN_EQUAL, 
            field: 'age', 
            value: 18,
        });
        expect(leafs(output)[1]).toMatchObject({
            operator: FilterFieldOperator.LESS_THAN, 
            field: 'age', 
            value: 65,
        });
        expect(leafs(output)[2]).toMatchObject({
            operator: FilterFieldOperator.CONTAINS, 
            field: 'name', 
            value: 'oh',
        });
    });

    it('should desugar a $size operator object to a size condition', () => {
        const output = defineFilters<User>({ items: { $size: 2 } });

        expect(leafs(output)).toHaveLength(1);
        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.SIZE,
            field: 'items',
            value: 2,
        });
    });

    it('should desugar a bare RegExp to a regex condition', () => {
        const pattern = /^Jo/;
        const output = defineFilters<User>({ name: pattern });

        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.REGEX,
            field: 'name',
            value: pattern,
        });
    });

    it('should desugar a nested record to dot-path conditions', () => {
        const output = defineFilters<User>({ realm: { name: 'master' } });

        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.EQUAL,
            field: 'realm.name',
            value: 'master',
        });
    });

    it('should desugar $elemMatch with build input and with a helper condition', () => {
        const fromInput = defineFilters<User>({ items: { $elemMatch: { name: 'chess' } } });

        const leaf = leafs(fromInput)[0] as IFilter;
        expect(leaf.operator).toBe(FilterFieldOperator.ELEM_MATCH);
        expect(leaf.field).toBe('items');
        expect(leaf.value).toMatchObject({
            operator: FilterFieldOperator.EQUAL,
            field: 'name',
            value: 'chess',
        });

        const condition = eq('name', 'chess');
        const fromHelper = defineFilters<User>({ items: { $elemMatch: condition } });
        expect((leafs(fromHelper)[0] as IFilter).value).toBe(condition);
    });

    it('should desugar an element-level $elemMatch operator object onto ITSELF', () => {
        const output = defineFilters({ scores: { $elemMatch: { $gt: 5 } } });

        const leaf = leafs(output)[0] as IFilter;
        expect(leaf.operator).toBe(FilterFieldOperator.ELEM_MATCH);
        expect(leaf.field).toBe('scores');
        expect(leaf.value).toMatchObject({
            operator: FilterFieldOperator.GREATER_THAN,
            field: ITSELF,
            value: 5,
        });

        // several element-level operators form an implicit AND interior.
        const range = defineFilters({ scores: { $elemMatch: { $gt: 5, $lt: 10 } } });
        const interior = (leafs(range)[0] as IFilter).value as Filters;
        expect(interior.operator).toBe(FilterCompoundOperator.AND);
        expect(interior.value).toHaveLength(2);
        expect(interior.value[0]).toMatchObject({ field: ITSELF, value: 5 });
        expect(interior.value[1]).toMatchObject({ field: ITSELF, value: 10 });
    });

    it('should accept the ITSELF marker inside an elemMatch interior', () => {
        const condition = elemMatch('tags', eq(ITSELF, 'a'));

        const output = defineFilters(condition);
        expect(leafs(output)[0]).toBe(condition);

        // explicit ITSELF key in the interior document form.
        const fromInput = defineFilters({ tags: { $elemMatch: { $this: 'a' } } });
        expect((leafs(fromInput)[0] as IFilter).value).toMatchObject({
            operator: FilterFieldOperator.EQUAL,
            field: ITSELF,
            value: 'a',
        });
    });

    it('should throw a typed error on the ITSELF marker outside an elemMatch interior', () => {
        const inputs = [
            () => defineFilters(eq(ITSELF, 5)),
            () => defineFilters({ $this: 5 } as never),
            () => defineFilters({ 'items.$this': 5 } as never),
            () => defineFilters(eq(`items.${ITSELF}`, 5)),
            () => defineFilters(elemMatch(ITSELF, eq('name', 'x'))),
        ];

        for (const input of inputs) {
            try {
                input();
                expect.fail('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BuildError);
                expect((e as BuildError).code).toBe(ErrorCode.KEY_INVALID);
            }
        }
    });

    it('should pass a compound helper value through unchanged', () => {
        const compound = or(gte('age', 18), eq('email', null));

        const output = defineFilters<User>(compound);
        expect(output).toBe(compound);
    });

    it('should wrap a leaf helper value into the canonical root-AND', () => {
        const leaf = eq('name', 'John');

        const output = defineFilters<User>(leaf);
        expect(output).toBeInstanceOf(Filters);
        expect(output.operator).toBe(FilterCompoundOperator.AND);
        expect(output.value).toEqual([leaf]);
    });

    it('should throw a typed error on an unsupported operator key', () => {
        expect(() => defineFilters({ name: { $like: 'Jo%' } } as never))
            .toThrowError(BuildError);

        try {
            defineFilters({ name: { $like: 'Jo%' } } as never);
        } catch (e) {
            expect((e as BuildError).code).toBe(ErrorCode.OPERATOR_UNSUPPORTED);
        }
    });

    it('should throw a typed error when operator and record keys are mixed', () => {
        try {
            defineFilters({ name: { $contains: 'Jo', nested: 'x' } } as never);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BuildError);
            expect((e as BuildError).code).toBe(ErrorCode.KEY_INVALID);
        }
    });

    it('should skip operator keys that are present but undefined', () => {
        // conditional spreads leave optional keys set to undefined —
        // they must not leak conditions with undefined values.
        const output = defineFilters<User>({ age: { $gte: undefined, $lt: 65 } });

        expect(leafs(output)).toHaveLength(1);
        expect(leafs(output)[0]).toMatchObject({
            operator: FilterFieldOperator.LESS_THAN, 
            field: 'age', 
            value: 65,
        });
    });

    it('should throw a typed error when a condition node is used as a field value', () => {
        // a helper already carries its own field — as a field value it is
        // ambiguous and must not be expanded into operator/field/value leaves.
        try {
            defineFilters({ age: gte('age', 18) } as never);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BuildError);
            expect((e as BuildError).code).toBe(ErrorCode.KEY_VALUE_INVALID);
        }
    });
});

describe('src/build/parameter/{fields,sorts,relations,pagination}/*.ts', () => {
    it('should desugar fields with include/exclude prefixes', () => {
        const output = defineFields<User>(['id', 'name', '+email', '-age']);

        expect(output.value.map((el) => [el.name, el.operator])).toEqual([
            ['id', undefined],
            ['name', undefined],
            ['email', FieldOperator.INCLUDE],
            ['age', FieldOperator.EXCLUDE],
        ]);
    });

    it('should desugar the fields record and tuple forms to dot paths', () => {
        const record = defineFields<User>({ realm: ['id', 'name'] });
        expect(record.value.map((el) => el.name)).toEqual(['realm.id', 'realm.name']);

        const tuple = defineFields<User>([['id'], { realm: ['name'] }]);
        expect(tuple.value.map((el) => el.name)).toEqual(['id', 'realm.name']);
    });

    it('should desugar sort strings, arrays and records', () => {
        const single = defineSorts<User>('-age');
        expect(single.value.map((el) => [el.name, el.operator])).toEqual([
            ['age', SortDirection.DESC],
        ]);

        const array = defineSorts<User>(['name', '-age']);
        expect(array.value.map((el) => [el.name, el.operator])).toEqual([
            ['name', SortDirection.ASC],
            ['age', SortDirection.DESC],
        ]);

        const record = defineSorts<User>({ age: 'DESC', realm: { name: 'ASC' } });
        expect(record.value.map((el) => [el.name, el.operator])).toEqual([
            ['age', SortDirection.DESC],
            ['realm.name', SortDirection.ASC],
        ]);
    });

    it('should desugar relations arrays and records', () => {
        const array = defineRelations<User>(['realm', 'items.user']);
        expect(array.value.map((el) => el.name)).toEqual(['realm', 'items.user']);

        const record = defineRelations<User>({ realm: true, items: { user: true, realm: false } });
        expect(record.value.map((el) => el.name)).toEqual(['realm', 'items.user']);
    });

    it('should trim comma-separated string input', () => {
        // csv strings are an untyped runtime convenience: generic-less
        // calls check against the plain-string overload.
        const sorts = defineSorts('age, -name, ');
        expect(sorts.value.map((el) => [el.name, el.operator])).toEqual([
            ['age', SortDirection.ASC],
            ['name', SortDirection.DESC],
        ]);

        const relations = defineRelations('realm, items.user');
        expect(relations.value.map((el) => el.name)).toEqual(['realm', 'items.user']);

        const fields = defineFields('id, -email');
        expect(fields.value.map((el) => [el.name, el.operator])).toEqual([
            ['id', undefined],
            ['email', FieldOperator.EXCLUDE],
        ]);
    });

    it('should build pagination', () => {
        const output = definePagination({ limit: 10, offset: 20 });

        expect(output.limit).toBe(10);
        expect(output.offset).toBe(20);
    });

    it('should throw a typed error on non-object pagination input', () => {
        try {
            definePagination(null as never);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BuildError);
            expect((e as BuildError).code).toBe(ErrorCode.INPUT_INVALID);
        }
    });
});

describe('src/build/module.ts', () => {
    it('should build a query from typed input', () => {
        const output = defineQuery<User>({
            fields: ['id', 'name'],
            filters: { name: { $contains: 'oh' }, 'realm.id': [1, null] },
            relations: ['realm'],
            sort: '-age',
            pagination: { limit: 10 },
        });

        expect(output.fields.value.map((el) => el.name)).toEqual(['id', 'name']);
        expect(leafs(output.filters)).toHaveLength(2);
        expect(output.relations.value.map((el) => el.name)).toEqual(['realm']);
        expect(output.sorts.value.map((el) => [el.name, el.operator])).toEqual([
            ['age', SortDirection.DESC],
        ]);
        expect(output.pagination.limit).toBe(10);
        expect(output.pagination.offset).toBeUndefined();
    });

    it('should default missing parameters like the Query constructor', () => {
        const output = defineQuery();

        expect(output.fields.value).toEqual([]);
        expect(output.filters.operator).toBe(FilterCompoundOperator.AND);
        expect(output.filters.value).toEqual([]);
        expect(output.relations.value).toEqual([]);
        expect(output.sorts.value).toEqual([]);
        expect(output.pagination.limit).toBeUndefined();
    });

    it('should accept a compound helper tree as filters value', () => {
        const output = defineQuery<User>({ filters: or(gte('age', 18), eq('email', null)) });

        expect(output.filters.operator).toBe(FilterCompoundOperator.OR);
        expect(output.filters.value).toHaveLength(2);
    });

    it('should accept define* fragments without casts', () => {
        const filters = defineFilters<User>({ name: 'John' });
        const fields = defineFields<User>(['id', 'name']);
        const sorts = defineSorts<User>('-age');
        const relations = defineRelations<User>(['realm']);
        const pagination = definePagination({ limit: 5 });

        const output = defineQuery<User>({
            fields, 
            filters, 
            relations, 
            sort: sorts, 
            pagination,
        });

        expect(output.fields).toBe(fields);
        expect(output.filters).toBe(filters);
        expect(output.relations).toBe(relations);
        expect(output.sorts).toBe(sorts);
        expect(output.pagination).toBe(pagination);
    });

    it('should accept raw AST nodes as parameter values', () => {
        const filters = new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'John'),
        ]);

        const output = defineQuery<User>({ filters });
        expect(output.filters).toBe(filters);
    });
});
