/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { URLDecoder, URLEncoder } from '@rapiq/codec-url-simple';
import {
    Pagination,
    Query,
    SchemaRegistry,
    Sort,
    SortDirection,
    and,
    contains,
    defineQuery,
    defineSchema,
    eq,
    mergeQueries,
} from '@rapiq/core';
import { createURLCodecRegistry } from '../../src';

/**
 * M3 gate (roadmap 000): the hub gateway controller and a Vue
 * list-kit merge express in v2 without casts. Archetypes are lifted
 * from `.agents/references/privateaim-hub.md`.
 */

type Log = {
    id: string,
    level: string,
    message: string,
    node_id: string,
    created_at: string,
};

type User = {
    id: string,
    name: string,
    email: string,
    created_at: string,
    realm: { id: string, name: string },
};

/**
 * Hub's core service proxies log queries to the telemetry service
 * (analysis-node-log controller): it parses the client query against
 * an allow-list, transforms field names, pins server-side conditions
 * and emits a *new* query for the downstream rapiq-speaking service.
 * v1 made this awkward (ParseOutput ≠ BuildInput) — in v2 both legs
 * meet in the same Query AST.
 */
describe('gateway controller (hub archetype)', () => {
    const schemaRegistry = new SchemaRegistry();
    schemaRegistry.add(defineSchema<Log>({
        name: 'log',
        filters: {
            allowed: ['level', 'node_id', 'created_at'],
            // public API name → internal field name
            mapping: { severity: 'level' },
        },
        pagination: { maxLimit: 50 },
        sort: { allowed: ['created_at'] },
    }));

    const decoder = new URLDecoder(schemaRegistry);
    const encoder = new URLEncoder(schemaRegistry);

    // express-style req.query: aliased key, disallowed key,
    // oversized limit — everything a real client gets wrong.
    const requestQuery = {
        filter: { severity: 'error', secret: 'x' },
        page: { limit: '500' },
        sort: '-created_at',
    };

    it('should validate, pin a server condition and re-encode (flat forward)', () => {
        const query = decoder.decode(requestQuery, { schema: 'log' })!;

        // the gateway pins node_id with server priority: merge() is
        // per-field replace, so a client-sent node_id could never win.
        const forwarded = new Query({
            fields: query.fields,
            filters: and(eq<Log>('node_id', 'node-1')).merge(query.filters),
            pagination: query.pagination,
            relations: query.relations,
            sorts: query.sorts,
        });

        const wire = encoder.encode(forwarded);

        expect(decodeURIComponent(wire!)).toEqual(
            'filter[node_id]=node-1&filter[level]=error&page[limit]=50&sort=-created_at',
        );

        // the downstream service decodes the same AST the gateway built.
        const downstream = decoder.decode(wire!)!;

        expect(downstream.filters).toEqual(and(
            eq('node_id', 'node-1'),
            eq('level', 'error'),
        ));
        expect(downstream.pagination).toEqual(new Pagination(50, 0));
    });

    it('should carry undisplaceable scoping downstream via the codec registry', () => {
        const codecs = createURLCodecRegistry(schemaRegistry);

        const query = codecs.decode(requestQuery, { schema: 'log' })!;

        // filters.and() wraps — the injected condition cannot be
        // displaced by any later merge. The wrapped tree is a nested
        // compound, which only the expression dialect can carry over
        // a URL; the registry stamps the codec identity so the
        // downstream service knows how to decode it.
        const scoped = new Query({
            fields: query.fields,
            filters: query.filters.and(eq<Log>('node_id', 'node-1')),
            pagination: query.pagination,
            relations: query.relations,
            sorts: query.sorts,
        });

        const wire = codecs.encode(scoped, { codec: 'url-expression' });

        expect(decodeURIComponent(wire!)).toEqual(
            'codec=url-expression' +
            '&filter=and(and(eq(level,\'error\')),eq(node_id,\'node-1\'))' +
            '&page[limit]=50&sort=-created_at',
        );

        // downstream: dispatch on the stamp, same AST comes out.
        const downstream = codecs.decode(wire!)!;

        expect(downstream.filters).toEqual(
            and(eq('level', 'error')).and(eq('node_id', 'node-1')),
        );
    });
});

/**
 * Hub's client-vue list composable merges component defaults, the
 * parent's query prop and live pagination state. v1 needed
 * smob.createMerger plus `as any` spreads — in v2 the fragments are
 * plain defineQuery() results composed with mergeQueries()
 * (left-priority; pagination merges per-property).
 */
describe('list-kit merge (vue archetype)', () => {
    it('should compose defaults, props and pagination state without casts', () => {
        const defaults = defineQuery<User>({
            pagination: { limit: 10 },
            relations: ['realm'],
            sort: '-created_at',
        });

        const propsQuery = defineQuery<User>({ filters: { name: { $contains: 'jo' } } });

        const paginationState = defineQuery<User>({ pagination: { offset: 20 } });

        const query = mergeQueries(paginationState, propsQuery, defaults);

        expect(query.pagination).toEqual(new Pagination(10, 20));
        expect(query.filters).toEqual(and(contains('name', 'jo')));

        // isQuerySortedDescByDate archetype: v1 inspected build-input
        // string/object shapes — on the AST it is a plain property read.
        expect(query.sorts.value[0]).toEqual(new Sort('created_at', SortDirection.DESC));

        const encoder = new URLEncoder();

        expect(decodeURIComponent(encoder.encode(query)!)).toEqual(
            'filter[name]=~jo~&page[limit]=10&page[offset]=20&include=realm&sort=-created_at',
        );
    });
});
