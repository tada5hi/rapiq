/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    Query,
    eq,
} from '@rapiq/core';
import {
    PrismaAdapter,
    assertSchemaMatchesModel,
    defineMetadata,
    defineSchemaRegistryWithDatamodel,
    defineSchemaWithModel,
    normalizeDatamodel,
    resolveClientProvider,
    resolveModelName,
} from '../../src';
import { datamodel } from '../data/datamodel';

/**
 * The runtime datamodel keys models by name and strips the name from
 * the entries; a client instance carries it plus the active provider,
 * and a model delegate points back at its client. Shapes verified
 * against a real generated client by the engine suite; these specs
 * pin the resolution logic itself.
 */
function createFakeClient(provider = 'postgresql') {
    const models : Record<string, any> = {};
    for (const model of datamodel.models) {
        models[model.name] = { fields: model.fields };
    }

    const client : Record<string, any> = {
        _runtimeDataModel: { models },
        _activeProvider: provider,
    };

    client.user = {
        $name: 'User',
        $parent: client,
        fields: { id: { modelName: 'User', name: 'id' } },
        findMany: () => [],
    };

    return client;
}

describe('src/metadata/normalize.ts', () => {
    it('should answer identically from every datamodel source', () => {
        const client = createFakeClient();

        const fromDatamodel = defineMetadata(datamodel, 'User');
        const fromClient = defineMetadata(client, 'User');
        const fromRuntime = defineMetadata(client._runtimeDataModel, 'User');

        const paths = ['realm', 'items', 'first_name', 'address', 'realm.name', 'items.color'];

        for (const path of paths) {
            for (const metadata of [fromClient, fromRuntime]) {
                expect([path, metadata.isRelation(path)]).toEqual([path, fromDatamodel.isRelation(path)]);
                expect([path, metadata.isToMany(path)]).toEqual([path, fromDatamodel.isToMany(path)]);
                expect([path, metadata.isNullable(path)]).toEqual([path, fromDatamodel.isNullable(path)]);
                expect([path, metadata.isString(path)]).toEqual([path, fromDatamodel.isString(path)]);
            }
        }
    });

    it('should prefer the public $datamodel reflection surface', () => {
        // prisma#29792 exposes `$datamodel`; the private read stays a
        // fallback. The private shadow here is pruned, so consulting
        // it first would throw instead of resolving.
        const client = createFakeClient();
        const surfaced = {
            $datamodel: client._runtimeDataModel,
            _runtimeDataModel: {
                models: {
                    User: {
                        fields: [{
                            name: 'id', 
                            kind: 'scalar', 
                            type: 'Int', 
                        }], 
                    }, 
                },
            },
        };

        const metadata = defineMetadata(surfaced, 'User');

        expect(metadata.isRelation('items')).toBeTruthy();
        expect(metadata.isToMany('items')).toBeTruthy();
        expect(metadata.isNullable('address')).toBeTruthy();
    });

    it('should resolve a model name from a delegate', () => {
        const client = createFakeClient();

        expect(resolveModelName('User')).toEqual('User');
        expect(resolveModelName(client.user)).toEqual('User');
        expect(resolveModelName({ fields: { id: { modelName: 'User' } } })).toEqual('User');
    });

    it('should fail typed for a pruned datamodel', () => {
        // edge/wasm builds strip cardinality and nullability.
        const pruned = {
            models: [{
                name: 'User',
                fields: [{
                    name: 'id', 
                    kind: 'scalar', 
                    type: 'Int', 
                }],
            }],
        };

        expect(() => normalizeDatamodel(pruned as any)).toThrowError(
            expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
        );
    });

    it('should fail typed for an unrecognizable source', () => {
        expect(() => normalizeDatamodel({} as any)).toThrowError(
            expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
        );
    });
});

describe('src/schema (client sources)', () => {
    it('should derive a registry straight from a client', () => {
        const client = createFakeClient();

        const registry = defineSchemaRegistryWithDatamodel(client, { schemas: { user: { filters: { allowed: ['id'] } } } });

        expect(registry.get('user')?.filters.allowed).toEqual(['id']);
        expect(registry.get('user')?.mapSchema('items')).toEqual('item');
        expect(registry.get('realm')).toBeDefined();
    });

    it('should derive and assert from a delegate', () => {
        const client = createFakeClient();

        const schema = defineSchemaWithModel(client, client.user, { fields: { allowed: 'inherit' } });

        expect(schema.name).toEqual('user');
        expect(() => assertSchemaMatchesModel(schema, client, client.user)).not.toThrow();
    });
});

describe('src/provider/module.ts (client)', () => {
    it('should read the active provider off a client', () => {
        expect(resolveClientProvider(createFakeClient('mysql'))).toEqual('mysql');
        expect(resolveClientProvider({ _engineConfig: { activeProvider: 'sqlite' } })).toEqual('sqlite');
    });

    it('should prefer the public $provider reflection surface', () => {
        expect(resolveClientProvider({ $provider: 'postgresql', _activeProvider: 'mysql' })).toEqual('postgresql');
    });

    it('should fail typed when the provider is unreadable', () => {
        expect(() => resolveClientProvider({})).toThrowError(
            expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED }),
        );
    });
});

describe('src/adapter/module.ts (client options)', () => {
    const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('first_name', 'Peter')]) });

    it('should bind everything from a model delegate', () => {
        const client = createFakeClient();

        const { args } = new PrismaAdapter({ model: client.user }).execute(query);

        // provider postgresql (mode emitted), metadata bound (string column)
        expect(args.where).toEqual({ first_name: { equals: 'Peter', mode: 'insensitive' } });
    });

    it('should bind from a client and a model name', () => {
        const client = createFakeClient('mysql');

        const { args } = new PrismaAdapter({ client, model: 'User' }).execute(query);

        // the mysql collation compares case-insensitively on its own
        expect(args.where).toEqual({ first_name: { equals: 'Peter' } });
    });

    it('should let explicit overrides win over derived values', () => {
        const client = createFakeClient('postgresql');

        const { args } = new PrismaAdapter({
            model: client.user,
            provider: 'sqlite',
        }).execute(query);

        expect(args.where).toEqual({ first_name: { equals: 'Peter' } });
    });

    it('should fail typed for a delegate without a client backref', () => {
        expect(() => new PrismaAdapter({ model: { fields: { id: { modelName: 'User' } } } })).toThrowError(
            expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
        );
    });
});
