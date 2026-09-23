/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AggregatesParseError,
    AggregatesSchema,
    GroupsParseError,
    GroupsSchema,
    KeyResolutionErrorCode,
    Parameter,
    ResolutionScope,
    SchemaRegistry,
    defineAggregatesSchema,
    defineGroupsSchema,
    defineSchema,
    isParseError,
} from '../../../src';
import type { Order } from '../../data';
import { orderSchema } from '../../data/schema';

describe('src/schema/module.ts', () => {
    it('should build the groups and aggregates sub-schemas', () => {
        expect(orderSchema.groups).toBeInstanceOf(GroupsSchema);
        expect(orderSchema.aggregates).toBeInstanceOf(AggregatesSchema);
        expect(orderSchema.groups.allowed).toEqual(['status', 'realmId']);
        expect(Object.keys(orderSchema.aggregates.functions)).toEqual(['count', 'total', 'revenue']);
    });

    it('should default both sub-schemas to permitting nothing', () => {
        const schema = defineSchema<Order>({});

        expect(schema.groups.allowedIsUndefined).toBe(true);
        expect(schema.groups.functions).toEqual({});
        expect(schema.aggregates.functionsIsUndefined).toBe(true);
    });

    it('should pass sub-schema instances through', () => {
        const groups = defineGroupsSchema<Order>({ allowed: ['status'] });
        const aggregates = defineAggregatesSchema<Order>({ functions: { count: {} } });
        const schema = defineSchema<Order>({ groups, aggregates });

        expect(schema.groups).toBe(groups);
        expect(schema.aggregates).toBe(aggregates);
    });

    it('should stamp the name on both sub-schemas, also on rename', () => {
        const schema = defineSchema<Order>({ name: 'order' });

        expect(schema.groups.name).toBe('order');
        expect(schema.aggregates.name).toBe('order');

        schema.name = 'purchase';

        expect(schema.groups.name).toBe('purchase');
        expect(schema.aggregates.name).toBe('purchase');
    });

    it('should not hand the failure policy or strict mode to groups and aggregates', () => {
        const schema = defineSchema<Order>({
            throwOnFailure: true,
            strict: true,
            groups: { allowed: ['status'] },
            aggregates: { functions: { count: {} } },
        });

        expect(schema.groups.throwOnFailure).toBeUndefined();
        expect(schema.groups.strict).toBeUndefined();
        expect(schema.aggregates.throwOnFailure).toBeUndefined();
        expect(schema.aggregates.strict).toBeUndefined();
    });
});

describe('src/schema/resolver/module.ts', () => {
    const registry = new SchemaRegistry();

    it('should project the groups and aggregates sub-schemas', () => {
        expect(ResolutionScope.for(registry, Parameter.GROUPS, orderSchema).schema).toBe(orderSchema.groups);
        expect(ResolutionScope.for(registry, Parameter.AGGREGATES, orderSchema).schema).toBe(orderSchema.aggregates);
        expect(ResolutionScope.for(registry, Parameter.GROUPS, orderSchema.groups).schema).toBe(orderSchema.groups);
        expect(ResolutionScope.for(registry, Parameter.GROUPS).schema).toBeInstanceOf(GroupsSchema);
        expect(ResolutionScope.for(registry, Parameter.AGGREGATES).schema).toBeInstanceOf(AggregatesSchema);
    });

    it('should never admit a groups or aggregates key through resolveKey', () => {
        expect(ResolutionScope.for(registry, Parameter.GROUPS, orderSchema).resolveKey('status')).toEqual({
            success: false,
            code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
            input: 'status',
            segment: 'status',
        });

        expect(ResolutionScope.for(registry, Parameter.AGGREGATES).resolveKey('count')).toEqual({
            success: false,
            code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
            input: 'count',
            segment: 'count',
        });
    });

    it('should raise the parameter error class outside a parse', () => {
        const groups = ResolutionScope.for(registry, Parameter.GROUPS, undefined, { throwOnFailure: true });
        const aggregates = ResolutionScope.for(registry, Parameter.AGGREGATES, undefined, { throwOnFailure: true });

        expect(() => groups.resolveKey('status')).toThrow(GroupsParseError);
        expect(() => aggregates.resolveKey('count')).toThrow(AggregatesParseError);
        expect(isParseError(new GroupsParseError())).toBe(true);
    });
});
