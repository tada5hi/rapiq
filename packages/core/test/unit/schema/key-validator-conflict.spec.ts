/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FieldsSchema,
    Parameter,
    RelationsSchema,
    SchemaError,
    SortSchema,
    defineFieldsSchema,
    defineRelationsSchema,
    defineSchema,
    defineSortSchema,
} from '../../../src';

const hooks = {
    validate: () => true,
    validateMany: (names: string[]) => Object.fromEntries(
        names.map((name) => [name, true]),
    ),
};

function expectConflict(fn: () => unknown, parameter: `${Parameter}`) {
    expect(fn).toThrow(SchemaError);

    try {
        fn();
    } catch (e) {
        expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_KEY_VALIDATOR_CONFLICT);
        expect((e as SchemaError).message).toContain(parameter);
    }
}

describe('src/schema/base.ts', () => {
    describe('key validator conflict', () => {
        it('should throw for a fields sub-schema declaring both hooks', () => {
            expectConflict(() => defineFieldsSchema(hooks), Parameter.FIELDS);
            expectConflict(() => new FieldsSchema(hooks), Parameter.FIELDS);
        });

        it('should throw for a relations sub-schema declaring both hooks', () => {
            expectConflict(() => defineRelationsSchema(hooks), Parameter.RELATIONS);
            expectConflict(() => new RelationsSchema(hooks), Parameter.RELATIONS);
        });

        it('should throw for a sort sub-schema declaring both hooks', () => {
            expectConflict(() => defineSortSchema(hooks), Parameter.SORT);
            expectConflict(() => new SortSchema(hooks), Parameter.SORT);
        });

        it('should throw for a schema declaring both hooks on fields', () => {
            expectConflict(() => defineSchema({ fields: hooks }), Parameter.FIELDS);
        });

        it('should throw for a schema declaring both hooks on relations', () => {
            expectConflict(() => defineSchema({ relations: hooks }), Parameter.RELATIONS);
        });

        it('should throw for a schema declaring both hooks on sort', () => {
            expectConflict(() => defineSchema({ sort: hooks }), Parameter.SORT);
        });

        it('should accept either hook on its own', () => {
            expect(() => defineSchema({
                fields: { validate: hooks.validate },
                relations: { validateMany: hooks.validateMany },
                sort: { validate: hooks.validate },
            })).not.toThrow();
        });

        it('should report the hook pair through the schema accessors', () => {
            const perKey = defineFieldsSchema({ validate: hooks.validate });
            expect(perKey.hasValidator()).toBe(true);
            expect(perKey.hasManyValidator()).toBe(false);

            const batched = defineFieldsSchema({ validateMany: hooks.validateMany });
            expect(batched.hasValidator()).toBe(true);
            expect(batched.hasManyValidator()).toBe(true);

            const none = defineFieldsSchema({ allowed: ['id'] });
            expect(none.hasValidator()).toBe(false);
            expect(none.hasManyValidator()).toBe(false);
        });

        it('should accept every key when no hook is declared', () => {
            const schema = defineSortSchema({ allowed: ['id'] });

            const scope = { parameter: Parameter.SORT, path: '' };

            expect(schema.validate('id', undefined, scope)).toBe(true);
            expect(schema.validateMany(['id'], undefined, scope)).toEqual({});
        });
    });
});
