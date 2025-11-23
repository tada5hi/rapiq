/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FiltersParseOptions } from 'rapiq';
import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    Relation,
    Relations,
    defineFiltersSchema,
} from 'rapiq';
import { SimpleFiltersParser } from '../../../src';
import { registry } from '../../data/schema';

describe('src/filter/index.ts', () => {
    let parser : SimpleFiltersParser;

    const parseFlat = (input: unknown, options: FiltersParseOptions = {}) => {
        const output = parser.parse(input, options);
        if (output.value.length === 1) {
            return output.value[0];
        }

        return output;
    };

    beforeAll(() => {
        parser = new SimpleFiltersParser(registry);
    });

    it('should parse with allowed', async () => {
        // filter id
        const output = parseFlat({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'id', 1));
    });

    it('should parse with allowed (underscore key)', async () => {
        // filter with underscore key
        const output = parseFlat({ display_name: 'admin' }, {
            schema: defineFiltersSchema({
                allowed: ['display_name'],
            }),
        });

        expect(output).toEqual(new Filter(FilterFieldOperator.EQUAL, 'display_name', 'admin'));
    });

    it('should parse with allowed (empty)', async () => {
        // filter none
        const output = parseFlat({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: [],
            }),
        });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should parse with allowed (undefined)', async () => {
        // filter
        const output = parseFlat({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });

        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        );
    });

    it('should parse with allowed & mapping', async () => {
        // filter with mapping
        const output = parseFlat({ aliasId: 1 }, {
            schema: defineFiltersSchema({
                mapping: { aliasId: 'id' },
                allowed: ['id'],
            }),
        });

        expect(output).toEqual(

            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        );
    });

    it('should not parse with non matching name', async () => {
        // filter wrong allowed
        const output = parseFlat({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should not parse with invalid name', async () => {
        const output = parseFlat({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should parse invalid name if permitted by allowed', async () => {
        const output = parseFlat({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id!'],
            }),
        });

        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'id!', 1),
        );
    });

    it('should not parse empty input', async () => {
        const output = parseFlat({ name: '' }, {
            schema: defineFiltersSchema({
                allowed: ['name'],
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should parse null input', async () => {
        let output = parseFlat({ name: null });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'name', null),
        );

        output = parseFlat({ name: 'null' });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'name', null),
        );
    });

    it('should not parse empty object', async () => {
        const output = parseFlat({});
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should parse with default', async () => {
        let output = parseFlat({ id: 1 }, {
            schema: defineFiltersSchema({
                default: new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
                allowed: [],
            }),
        });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
        );

        output = parseFlat({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                default: new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            }),
        });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'name', 'tada5hi'),
        );
    });

    it('should parse with default path', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'display_name'],
            name: 'user',
        });

        let output = parseFlat({ id: 1 }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        );

        output = parseFlat({ display_name: 'admin' }, { schema });

        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'display_name', 'admin'),
        );
    });

    it('should parse with different number input', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id'],
        });

        // equal operator
        let output = parseFlat({ id: '1' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        );

        // negation with equal operator
        output = parseFlat({ id: '!1' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.NOT_EQUAL, 'id', 1),
        );

        // in operator
        output = parseFlat({ id: 'null,0,1,2,3' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.IN, 'id', [null, 0, 1, 2, 3]),
        );

        // negation with in operator
        output = parseFlat({ id: '!1,2,3' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.NOT_IN, 'id', [1, 2, 3]),
        );

        // less than operator
        output = parseFlat({ id: '<10' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.LESS_THAN, 'id', 10),
        );

        // less than equal operator
        output = parseFlat({ id: '<=10' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'id', 10),
        );

        // more than operator
        output = parseFlat({ id: '>10' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.GREATER_THAN, 'id', 10),
        );

        // more than equal operator
        output = parseFlat({ id: '>=10' }, { schema });
        expect(output).toEqual(
            new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'id', 10),
        );
    });

    it('should parse different string match inputs', async () => {
        const schema = defineFiltersSchema({
            allowed: ['name'],
        });

        // startsWith
        let output = parseFlat({ name: 'name~' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.STARTS_WITH,
                'name',
                'name',
            ),
        );

        // endsWith
        output = parseFlat({ name: '~name' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.ENDS_WITH,
                'name',
                'name',
            ),
        );

        // contains
        output = parseFlat({ name: '~name~' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.CONTAINS,
                'name',
                'name',
            ),
        );

        // not endsWith
        output = parseFlat({ name: '!~name' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.NOT_ENDS_WITH,
                'name',
                'name',
            ),
        );

        // not startsWith
        output = parseFlat({ name: '!name~' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.NOT_STARTS_WITH,
                'name',
                'name',
            ),
        );

        // not contains
        output = parseFlat({ name: '!~name~' }, { schema });
        expect(output).toEqual(
            new Filter(
                FilterFieldOperator.NOT_CONTAINS,
                'name',
                'name',
            ),
        );
    });

    it('should parse with includes', async () => {
        // simple
        let output = parseFlat({ id: 1, 'realm.id': 2 }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
            throwOnFailure: true,
        });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'realm.id', 2),
                ],
            ),
        );

        // with include & query alias
        output = parseFlat({ id: 1, 'realm.id': 3 }, { schema: 'user' });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'realm.id', 3),
                ],
            ),
        );

        // todo: should be "role"."id" instead of "user_roles"."role.id"
        // with deep nested include
        output = parseFlat({ id: 1, 'realm.item.id': 4 }, { schema: 'user' });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    new Filter(FilterFieldOperator.EQUAL, 'realm.item.id', 4),
                ],
            ),
        );
    });

    it('should throw on invalid input shape', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.inputInvalid();

        expect(() => parseFlat('foo', { schema })).toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyInvalid('1foo');

        expect(() => parseFlat({
            '1foo': 1,
        }, { schema })).toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FiltersParseError.keyPathInvalid('bar');

        expect(() => parseFlat({
            'bar.bar': 1,
        }, {
            schema,
            relations: new Relations([
                new Relation('user'),
            ]),
        })).toThrow(error);
    });

    it('should throw on non allowed key which is not covered by a relation', async () => {
        const error = FiltersParseError.keyInvalid('bar');

        expect(() => parseFlat({
            'realm.bar': 1,
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
            throwOnFailure: true,
        })).toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = FiltersParseError.keyInvalid('bar');

        expect(() => parseFlat({
            bar: 1,
        }, { schema })).toThrow(error);
    });
});
