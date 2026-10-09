/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Parameter,
    ResolutionScope,
    SchemaRegistry,
    defineSchema,
} from '../../../src';
import type { PendingKeyValidation } from '../../../src';
import { registry } from '../../data/schema';

function keyed(sink: PendingKeyValidation[]) : Array<{ key: string, path: string }> {
    return sink.map((entry) => ({ key: entry.key, path: entry.path }));
}

describe('src/schema/resolver obligation recording', () => {
    it('records the relations a dotted key traverses into the sink', () => {
        const sink : PendingKeyValidation[] = [];
        const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', { obligationSink: sink });

        const resolved = scope.resolveKey('items.id');

        expect(resolved.success).toBe(true);
        expect(keyed(sink)).toEqual([{ key: 'items', path: 'items' }]);
        expect(sink[0]?.schema.hasValidator).toBeTypeOf('function');
    });

    it('records the include relation itself for the relations parameter', () => {
        const sink : PendingKeyValidation[] = [];
        const scope = ResolutionScope.for(registry, Parameter.RELATIONS, 'user', { obligationSink: sink });

        scope.resolveKey('items');

        expect(keyed(sink)).toEqual([{ key: 'items', path: 'items' }]);
    });

    it('records each segment of a deep include path', () => {
        const sink : PendingKeyValidation[] = [];
        const scope = ResolutionScope.for(registry, Parameter.RELATIONS, 'user', { obligationSink: sink });

        scope.resolveKey('items.realm');

        expect(keyed(sink)).toEqual([
            { key: 'items', path: 'items' },
            { key: 'realm', path: 'items.realm' },
        ]);
    });

    it('records a relation targeted directly by a filter (array operator target)', () => {
        const scoped = new SchemaRegistry();
        scoped.add(defineSchema({
            name: 'user',
            filters: { allowed: ['id', 'items'] },
            relations: { allowed: ['items'] },
            schemaMapping: { items: 'item' },
        }));
        scoped.add(defineSchema({ name: 'item', filters: { allowed: ['id'] } }));

        const sink : PendingKeyValidation[] = [];
        const scope = ResolutionScope.for(scoped, Parameter.FILTERS, 'user', { obligationSink: sink });

        scope.resolveKey('items');

        expect(keyed(sink)).toEqual([{ key: 'items', path: 'items' }]);
    });

    it('records nothing for a scalar leaf', () => {
        const sink : PendingKeyValidation[] = [];
        const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user', { obligationSink: sink });

        scope.resolveKey('name');

        expect(sink).toEqual([]);
    });

    it('is a no-op when no sink is supplied', () => {
        const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');

        expect(() => scope.resolveKey('items.id')).not.toThrow();
    });
});
