/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    defineIssueGroup,
    flattenIssueItems,
} from 'blemish';
import {
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    FiltersParseError,
    IssueCollector,
    Parameter,
    SchemaError,
    SchemaRegistry,
    Sort,
    SortDirection,
    Sorts,
    applyFiltersIndexPolicy,
    applySortsIndexPolicy,
    buildIssue,
    defineSchema,
    eq,
    extractIssueParameter,
    preserve,
} from '../../../src';

type Item = {
    id: string,
    user_id: string,
    name: string,
};

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    email: string,
    flag: boolean,
    items: Item[],
};

const buildRegistry = () => {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Row>({
        name: 'row',
        indexes: [['realm_id', 'created_at'], ['email']],
        filters: { indexed: true, default: eq('flag', true) },
        sort: { indexed: true, default: { created_at: 'DESC' } },
        schemaMapping: { items: 'item' },
    }));
    registry.add(defineSchema<Item>({
        name: 'item',
        indexes: [['user_id']],
        sort: { default: { name: 'ASC' } },
    }));

    return registry;
};

describe('src/parser/index-policy.ts', () => {
    it('should pass an anchored tree through unchanged', () => {
        const registry = buildRegistry();
        const output = new Filters(FilterCompoundOperator.AND, [eq('realm_id', 'x')]);

        expect(applyFiltersIndexPolicy(output, registry, 'row')).toBe(output);
    });

    it('should resolve relation paths through the registry', () => {
        const registry = buildRegistry();
        const output = new Filters(FilterCompoundOperator.AND, [eq('items.user_id', 'x')]);

        expect(applyFiltersIndexPolicy(output, registry, 'row')).toBe(output);
    });

    it('should drop a violating tree to the schema default', () => {
        const registry = buildRegistry();
        const output = new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]);

        const applied = applyFiltersIndexPolicy(output, registry, 'row');
        expect(applied).not.toBe(output);
        expect(applied.value).toEqual([eq('flag', true)]);
    });

    it('should throw typed under throwOnFailure', () => {
        const registry = buildRegistry();
        const output = new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]);

        try {
            applyFiltersIndexPolicy(output, registry, 'row', { throwOnFailure: true });
            expect.fail('expected a FiltersParseError');
        } catch (e) {
            expect(e).toBeInstanceOf(FiltersParseError);
            expect((e as FiltersParseError).code).toBe(ErrorCode.KEY_COMBINATION_NOT_INDEXED);
        }
    });

    it('should bypass the schema default tree', () => {
        const registry = buildRegistry();
        const schema = registry.getOrFail('row');
        const output = new Filters(FilterCompoundOperator.AND, [schema.filters.default!]);

        // flag is unindexed, but the default is server-authored.
        expect(applyFiltersIndexPolicy(output, registry, 'row')).toBe(output);
    });

    it('should bypass a tree value-equal to the default', () => {
        const registry = buildRegistry();
        // fresh instances, same content as the default: what a codec
        // round-trip of the default tree produces.
        const output = new Filters(FilterCompoundOperator.AND, [eq('flag', true)]);

        expect(applyFiltersIndexPolicy(output, registry, 'row', { throwOnFailure: true }))
            .toBe(output);
    });

    it('should refuse to drop a preserved condition', () => {
        const registry = buildRegistry();
        const output = new Filters(FilterCompoundOperator.AND, [
            eq('created_at', 'x'),
            preserve(eq('deleted', false)),
        ]);

        try {
            applyFiltersIndexPolicy(output, registry, 'row');
            expect.fail('expected a SchemaError');
        } catch (e) {
            expect(e).toBeInstanceOf(SchemaError);
            expect((e as SchemaError).code).toBe(ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED);
        }
    });

    it('should throw on violation when no default exists to fall back to', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<Row>({
            name: 'row',
            indexes: [['realm_id']],
            filters: { indexed: true },
        }));
        const output = new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]);

        try {
            applyFiltersIndexPolicy(output, registry, 'row');
            expect.fail('expected a FiltersParseError');
        } catch (e) {
            expect(e).toBeInstanceOf(FiltersParseError);
            expect((e as FiltersParseError).code).toBe(ErrorCode.KEY_COMBINATION_NOT_INDEXED);
        }
    });

    it('should no-op without the indexed opt-in', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<Row>({
            name: 'row',
            indexes: [['realm_id']],
        }));
        const output = new Filters(FilterCompoundOperator.AND, [eq('flag', true)]);

        expect(applyFiltersIndexPolicy(output, registry, 'row')).toBe(output);
    });

    it('should apply the prefix rule to sorts', () => {
        const registry = buildRegistry();

        const ok = new Sorts([
            new Sort('realm_id', SortDirection.DESC),
            new Sort('created_at', SortDirection.ASC),
        ]);
        expect(applySortsIndexPolicy(ok, registry, 'row')).toBe(ok);

        const bad = new Sorts([new Sort('created_at', SortDirection.ASC)]);
        const applied = applySortsIndexPolicy(bad, registry, 'row');
        expect(applied).not.toBe(bad);
        expect(applied.value.map((sort) => [sort.name, sort.operator]))
            .toEqual([['created_at', SortDirection.DESC]]);
    });

    it('should bypass the sort defaults', () => {
        const registry = buildRegistry();
        const output = new Sorts([new Sort('created_at', SortDirection.DESC)]);

        expect(applySortsIndexPolicy(output, registry, 'row')).toBe(output);
    });

    it('should exempt relation-scope sort defaults from the check', () => {
        const registry = buildRegistry();
        // the shape the sort parser produces when a client's relation
        // sort keys all drop: a valid client root key plus the child
        // schema's server-authored default. Only the client key is
        // checked; the mixed-path combination must not reject it.
        const output = new Sorts([
            new Sort('realm_id', SortDirection.ASC),
            new Sort('items.name', SortDirection.ASC),
        ]);

        expect(applySortsIndexPolicy(output, registry, 'row', { throwOnFailure: true }))
            .toBe(output);
    });

    it('should apply both index policies despite failures in other parameters', () => {
        const registry = buildRegistry();
        const collector = new IssueCollector();
        collector.add({
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FIELDS,
            path: ['secret'],
            message: 'The key secret is not permitted.',
        });

        applyFiltersIndexPolicy(
            new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]),
            registry,
            'row',
            { throwOnFailure: true, issueCollector: collector },
        );
        applySortsIndexPolicy(
            new Sorts([new Sort('created_at', SortDirection.ASC)]),
            registry,
            'row',
            { throwOnFailure: true, issueCollector: collector },
        );

        expect(flattenIssueItems(collector.issues)
            .filter((issue) => issue.code === ErrorCode.KEY_COMBINATION_NOT_INDEXED)
            .map((issue) => extractIssueParameter(issue)))
            .toEqual([Parameter.FILTERS, Parameter.SORTS]);
    });

    it('should suppress only a filter consequence for a filter failure', () => {
        const registry = buildRegistry();
        const collector = new IssueCollector();
        collector.add({
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FILTERS,
            path: ['secret'],
            message: 'The key secret is not permitted.',
        });

        applyFiltersIndexPolicy(
            new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]),
            registry,
            'row',
            { throwOnFailure: true, issueCollector: collector },
        );

        expect(flattenIssueItems(collector.issues)).toHaveLength(1);
    });

    it('should suppress only a sort consequence for a sort failure', () => {
        const registry = buildRegistry();
        const collector = new IssueCollector();
        collector.add({
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.SORTS,
            path: ['secret'],
            message: 'The key secret is not permitted.',
        });

        applySortsIndexPolicy(
            new Sorts([new Sort('created_at', SortDirection.ASC)]),
            registry,
            'row',
            { throwOnFailure: true, issueCollector: collector },
        );

        expect(flattenIssueItems(collector.issues)).toHaveLength(1);
    });

    it('should find a same-parameter failure inside an issue group', () => {
        const registry = buildRegistry();
        const collector = new IssueCollector();
        collector.merge([defineIssueGroup({
            path: [],
            message: 'The filter input is invalid.',
            issues: [buildIssue({
                code: ErrorCode.KEY_NOT_ALLOWED,
                parameter: Parameter.FILTERS,
                path: ['secret'],
                message: 'The key secret is not permitted.',
            })],
        })]);

        applyFiltersIndexPolicy(
            new Filters(FilterCompoundOperator.AND, [eq('created_at', 'x')]),
            registry,
            'row',
            { throwOnFailure: true, issueCollector: collector },
        );

        expect(flattenIssueItems(collector.issues)).toHaveLength(1);
    });
});
