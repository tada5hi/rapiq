/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FieldsParseError,
    Parameter,
    RelationsParseError,
    SortParseError,
    and,
    applyKeySchemaValidation,
    applyKeySchemaValidationAsync,
    defineFieldsSchema,
    defineRelationsSchema,
    defineSortSchema,
    eq,
} from '../../../../src';
import type {
    ICondition,
    KeyValidatableSchema,
    KeyValidationOptions,
    KeyValidationScope,
    PendingKeyValidation,
    SchemaError,
} from '../../../../src';

function entry(
    schema: KeyValidatableSchema,
    key: string,
    path?: string,
) : PendingKeyValidation {
    return {
        key,
        path: path ?? key,
        schema,
    };
}

function fieldsOptions(
    conditions?: Map<string, ICondition>,
    throwOnFailure = false,
) : KeyValidationOptions {
    return {
        throwOnFailure,
        errors: FieldsParseError,
        conditions,
    };
}

describe('src/parser/parameter/validate.ts', () => {
    describe('verdict discrimination', () => {
        it('should accept a true verdict', () => {
            const schema = defineFieldsSchema({ validate: () => true });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'name')],
                undefined,
                fieldsOptions(),
            )).toEqual([]);
        });

        it('should accept truthy non-condition verdicts', () => {
            const verdicts : any[] = [true, 1, 'yes', {}, [], () => true];

            for (const verdict of verdicts) {
                const schema = defineFieldsSchema({ validate: () => verdict });

                expect(applyKeySchemaValidation(
                    [entry(schema, 'id')],
                    undefined,
                    fieldsOptions(),
                )).toEqual([]);
            }
        });

        it('should reject falsy verdicts', () => {
            const verdicts : any[] = [false, undefined, null, 0, '', Number.NaN];

            for (const verdict of verdicts) {
                const schema = defineFieldsSchema({ validate: () => verdict });

                expect(applyKeySchemaValidation(
                    [entry(schema, 'id')],
                    undefined,
                    fieldsOptions(),
                )).toEqual(['id']);
            }
        });

        it('should skip schemas without any validator', () => {
            const schema = defineFieldsSchema({ allowed: ['id'] });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id')],
                undefined,
                fieldsOptions(),
            )).toEqual([]);
        });

        it('should invoke the hook once per duplicated obligation', () => {
            const validate = vi.fn(() => true);
            const schema = defineFieldsSchema({ validate });

            applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'id'), entry(schema, 'name')],
                undefined,
                fieldsOptions(),
            );

            expect(validate).toHaveBeenCalledTimes(2);
        });

        it('should throw the parameter error naming the path under throwOnFailure', () => {
            const schema = defineFieldsSchema({ validate: () => false });

            expect.assertions(3);
            try {
                applyKeySchemaValidation(
                    [entry(schema, 'secret', 'items.secret')],
                    undefined,
                    fieldsOptions(undefined, true),
                );
            } catch (e) {
                expect(e).toBeInstanceOf(FieldsParseError);
                expect((e as FieldsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
                expect((e as FieldsParseError).message).toContain('items.secret');
            }
        });
    });

    describe('condition verdict', () => {
        it('should keep the key and record the condition for fields', () => {
            const condition = eq('realm.id', 'master');
            const conditions = new Map<string, ICondition>();
            const schema = defineFieldsSchema({ validate: (name) => (name === 'secret' ? condition : true) });

            const rejected = applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'secret')],
                undefined,
                fieldsOptions(conditions),
            );

            expect(rejected).toEqual([]);
            expect(conditions.size).toEqual(1);
            expect(conditions.get('secret')).toBe(condition);
        });

        it('should key the condition by the output path, not the hook key', () => {
            const condition = eq('id', 1);
            const conditions = new Map<string, ICondition>();
            const schema = defineFieldsSchema({ validate: () => condition });

            const rejected = applyKeySchemaValidation(
                [entry(schema, 'secret', 'items.realm.secret')],
                undefined,
                fieldsOptions(conditions),
            );

            expect(rejected).toEqual([]);
            expect([...conditions.keys()]).toEqual(['items.realm.secret']);
        });

        it('should accept a compound condition', () => {
            const condition = and(eq('id', 1), eq('name', 'admin'));
            const conditions = new Map<string, ICondition>();
            const schema = defineFieldsSchema({ validate: () => condition });

            expect(applyKeySchemaValidation(
                [entry(schema, 'secret')],
                undefined,
                fieldsOptions(conditions),
            )).toEqual([]);
            expect(conditions.get('secret')).toBe(condition);
        });

        it('should record a condition returned from a batched hook', () => {
            const condition = eq('id', 1);
            const conditions = new Map<string, ICondition>();
            const schema = defineFieldsSchema({ validateMany: () => ({ id: true, secret: condition }) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'secret')],
                undefined,
                fieldsOptions(conditions),
            )).toEqual([]);
            expect(conditions.get('secret')).toBe(condition);
        });

        it('should reject a condition when no sink is supplied', () => {
            const schema = defineFieldsSchema({ validate: () => eq('id', 1) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'secret')],
                undefined,
                fieldsOptions(),
            )).toEqual(['secret']);
        });

        it('should reject a condition for the sort parameter', () => {
            const conditions = new Map<string, ICondition>();
            const schema = defineSortSchema({ validate: () => eq('id', 1) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'name')],
                undefined,
                {
                    throwOnFailure: false,
                    errors: SortParseError,
                    conditions,
                },
            )).toEqual(['name']);
            expect(conditions.size).toEqual(0);
        });

        it('should reject a condition for the relations parameter', () => {
            const conditions = new Map<string, ICondition>();
            const schema = defineRelationsSchema({ validate: () => eq('id', 1) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'items')],
                undefined,
                {
                    throwOnFailure: false,
                    errors: RelationsParseError,
                    conditions,
                },
            )).toEqual(['items']);
            expect(conditions.size).toEqual(0);
        });

        it('should throw for a condition without a sink under throwOnFailure', () => {
            const schema = defineFieldsSchema({ validate: () => eq('id', 1) });

            expect.assertions(1);
            try {
                applyKeySchemaValidation(
                    [entry(schema, 'secret')],
                    undefined,
                    fieldsOptions(undefined, true),
                );
            } catch (e) {
                expect((e as FieldsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
            }
        });
    });

    describe('scope', () => {
        it('should hand an empty path and the schema name to a root key', () => {
            const scopes : KeyValidationScope[] = [];
            const schema = defineFieldsSchema({
                name: 'user',
                validate: (_name, _context, scope) => {
                    scopes.push(scope);

                    return true;
                },
            });

            applyKeySchemaValidation([entry(schema, 'id')], undefined, fieldsOptions());

            expect(scopes).toEqual([{
                parameter: Parameter.FIELDS,
                path: '',
                schema: 'user',
            }]);
        });

        it('should hand the governing relation path to a nested key', () => {
            const scopes : KeyValidationScope[] = [];
            const schema = defineFieldsSchema({
                name: 'realm',
                validate: (_name, _context, scope) => {
                    scopes.push(scope);

                    return true;
                },
            });

            applyKeySchemaValidation(
                [entry(schema, 'name', 'items.realm.name')],
                undefined,
                fieldsOptions(),
            );

            expect(scopes[0]?.path).toEqual('items.realm');
            expect(scopes[0]?.schema).toEqual('realm');
        });

        it('should leave the schema name undefined for an inline schema', () => {
            const scopes : KeyValidationScope[] = [];
            const schema = defineSortSchema({
                validate: (_name, _context, scope) => {
                    scopes.push(scope);

                    return true;
                },
            });

            applyKeySchemaValidation([entry(schema, 'id')], undefined, {
                throwOnFailure: false,
                errors: SortParseError,
            });

            expect(scopes).toEqual([{
                parameter: Parameter.SORT,
                path: '',
                schema: undefined,
            }]);
        });

        it('should forward the context to the hook', () => {
            const context = { permissions: ['user_read'] };
            const validate = vi.fn(() => true);
            const schema = defineFieldsSchema({ validate });

            applyKeySchemaValidation([entry(schema, 'id')], context, fieldsOptions());

            expect(validate).toHaveBeenCalledWith('id', context, {
                parameter: Parameter.FIELDS,
                path: '',
                schema: undefined,
            });
        });
    });

    describe('batched validation', () => {
        it('should fire once with the deduped keys in recorded order', () => {
            const validateMany = vi.fn((names: string[]) => Object.fromEntries(
                names.map((name) => [name, true]),
            ));
            const schema = defineFieldsSchema({ name: 'user', validateMany });

            const rejected = applyKeySchemaValidation(
                [
                    entry(schema, 'name'),
                    entry(schema, 'id'),
                    entry(schema, 'name'),
                    entry(schema, 'email'),
                ],
                undefined,
                fieldsOptions(),
            );

            expect(rejected).toEqual([]);
            expect(validateMany).toHaveBeenCalledTimes(1);
            expect(validateMany).toHaveBeenCalledWith(
                ['name', 'id', 'email'],
                undefined,
                {
                    parameter: Parameter.FIELDS,
                    path: '',
                    schema: 'user',
                },
            );
        });

        it('should fire once per scope path for the same schema instance', () => {
            const calls : { names: string[], path: string }[] = [];
            const schema = defineFieldsSchema({
                name: 'realm',
                validateMany: (names, _context, scope) => {
                    calls.push({ names, path: scope.path });

                    return Object.fromEntries(names.map((name) => [name, true]));
                },
            });

            const rejected = applyKeySchemaValidation(
                [
                    entry(schema, 'id', 'items.realm.id'),
                    entry(schema, 'name', 'realm.name'),
                    entry(schema, 'name', 'items.realm.name'),
                ],
                undefined,
                fieldsOptions(),
            );

            expect(rejected).toEqual([]);
            expect(calls).toEqual([
                { names: ['id', 'name'], path: 'items.realm' },
                { names: ['name'], path: 'realm' },
            ]);
        });

        it('should reject a key absent from the record', () => {
            const schema = defineFieldsSchema({ validateMany: () => ({ id: true }) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'secret')],
                undefined,
                fieldsOptions(),
            )).toEqual(['secret']);
        });

        it('should reject every key of an empty record', () => {
            const schema = defineFieldsSchema({ validateMany: () => ({}) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'name')],
                undefined,
                fieldsOptions(),
            )).toEqual(['id', 'name']);
        });

        it('should reject a key answered with a falsy verdict', () => {
            const schema = defineFieldsSchema({
                validateMany: () => ({
                    id: true,
                    secret: false,
                    other: undefined,
                }),
            });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id'), entry(schema, 'secret'), entry(schema, 'other')],
                undefined,
                fieldsOptions(),
            )).toEqual(['secret', 'other']);
        });

        it('should not let a prototype member forge an acceptance', () => {
            const schema = defineFieldsSchema({ validateMany: () => ({} as any) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'constructor'), entry(schema, 'toString')],
                undefined,
                fieldsOptions(),
            )).toEqual(['constructor', 'toString']);
        });

        it('should ignore keys the record answers but nobody asked for', () => {
            const schema = defineFieldsSchema({ validateMany: () => ({ id: true, unrequested: true }) });

            expect(applyKeySchemaValidation(
                [entry(schema, 'id')],
                undefined,
                fieldsOptions(),
            )).toEqual([]);
        });

        it('should preserve recorded order across batched and per-key schemas', () => {
            const log : string[] = [];
            const batched = defineFieldsSchema({
                name: 'user',
                validateMany: (names) => {
                    log.push(`many:${names.join(',')}`);

                    return Object.fromEntries(names.map((name) => [name, name !== 'c']));
                },
            });
            const perKey = defineFieldsSchema({
                name: 'realm',
                validate: (name) => {
                    log.push(`one:${name}`);

                    return false;
                },
            });

            const rejected = applyKeySchemaValidation(
                [
                    entry(batched, 'a'),
                    entry(perKey, 'b', 'realm.b'),
                    entry(batched, 'c'),
                ],
                undefined,
                fieldsOptions(),
            );

            expect(log).toEqual(['many:a,c', 'one:b']);
            expect(rejected).toEqual(['realm.b', 'c']);
        });

        it('should throw for the first rejected entry in recorded order', () => {
            const batched = defineFieldsSchema({
                validateMany: (names) => Object.fromEntries(
                    names.map((name) => [name, name !== 'c']),
                ),
            });
            const perKey = defineFieldsSchema({ validate: () => false });

            expect.assertions(1);
            try {
                applyKeySchemaValidation(
                    [
                        entry(batched, 'a'),
                        entry(perKey, 'b', 'realm.b'),
                        entry(batched, 'c'),
                    ],
                    undefined,
                    fieldsOptions(undefined, true),
                );
            } catch (e) {
                expect((e as FieldsParseError).message).toContain('realm.b');
            }
        });
    });

    describe('asynchronous hooks', () => {
        it('should refuse an async per-key hook on the sync driver', () => {
            const schema = defineFieldsSchema({ validate: async () => true });

            expect.assertions(1);
            try {
                applyKeySchemaValidation([entry(schema, 'id')], undefined, fieldsOptions());
            } catch (e) {
                expect((e as SchemaError).code)
                    .toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
            }
        });

        it('should refuse an async batched hook on the sync driver', () => {
            const schema = defineFieldsSchema({
                validateMany: async (names) => Object.fromEntries(
                    names.map((name) => [name, true]),
                ),
            });

            expect.assertions(1);
            try {
                applyKeySchemaValidation([entry(schema, 'id')], undefined, fieldsOptions());
            } catch (e) {
                expect((e as SchemaError).code)
                    .toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
            }
        });

        it('should refuse a plain thenable from a batched hook on the sync driver', () => {
            const schema = defineFieldsSchema({ validateMany: () => ({ then: (resolve: (value: any) => void) => resolve({ id: true }) } as any) });

            expect.assertions(1);
            try {
                applyKeySchemaValidation([entry(schema, 'id')], undefined, fieldsOptions());
            } catch (e) {
                expect((e as SchemaError).code)
                    .toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
            }
        });

        it('should await per-key hooks sequentially in recorded order', async () => {
            const log : string[] = [];
            const schema = defineFieldsSchema({
                validate: async (name) => {
                    await Promise.resolve();
                    log.push(name);

                    return name !== 'secret';
                },
            });

            const rejected = await applyKeySchemaValidationAsync(
                [entry(schema, 'id'), entry(schema, 'secret'), entry(schema, 'name')],
                undefined,
                fieldsOptions(),
            );

            expect(log).toEqual(['id', 'secret', 'name']);
            expect(rejected).toEqual(['secret']);
        });

        it('should await a batched hook once and honour a condition verdict', async () => {
            const condition = eq('id', 1);
            const conditions = new Map<string, ICondition>();
            const validateMany = vi.fn(async () => ({ id: true, secret: condition }));
            const schema = defineFieldsSchema({ validateMany });

            const rejected = await applyKeySchemaValidationAsync(
                [entry(schema, 'id'), entry(schema, 'secret')],
                undefined,
                fieldsOptions(conditions),
            );

            expect(rejected).toEqual([]);
            expect(validateMany).toHaveBeenCalledTimes(1);
            expect(conditions.get('secret')).toBe(condition);
        });

        it('should accept synchronous hooks on the async driver', async () => {
            const schema = defineFieldsSchema({ validate: (name) => name !== 'secret' });

            expect(await applyKeySchemaValidationAsync(
                [entry(schema, 'id'), entry(schema, 'secret')],
                undefined,
                fieldsOptions(),
            )).toEqual(['secret']);
        });

        it('should throw on rejection under throwOnFailure', async () => {
            const schema = defineFieldsSchema({ validate: async () => false });

            await expect(applyKeySchemaValidationAsync(
                [entry(schema, 'id')],
                undefined,
                fieldsOptions(undefined, true),
            )).rejects.toBeInstanceOf(FieldsParseError);
        });
    });
});
