/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Filter, FilterCompoundOperator, FilterFieldOperator, FilterRegexFlag, Filters,

    FiltersParseError, SimpleFiltersParser, createFilterRegex, defineFiltersSchema,
} from '../../../src';
import { Relation, Relations } from '../../../src/parameter';
import { registry } from '../../data/schema';

describe('src/filter/index.ts', () => {
    let parser : SimpleFiltersParser;

    beforeAll(() => {
        parser = new SimpleFiltersParser(registry);
    });

    it('should parse with allowed', async () => {
        // filter id
        const output = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id'],
            }),
        });

        console.log(output);

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );
    });

    it('should parse with allowed (underscore key)', async () => {
        // filter with underscore key
        const output = parser.parse({ display_name: 'admin' }, {
            schema: defineFiltersSchema({
                allowed: ['display_name'],
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'display_name', 'admin'),
                ],
            ),
        );
    });

    it('should parse with allowed (empty)', async () => {
        // filter none
        const output = parser.parse({ id: 1 }, {
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
        const output = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                allowed: undefined,
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );
    });

    it('should parse with allowed & mapping', async () => {
        // filter with mapping
        const output = parser.parse({ aliasId: 1 }, {
            schema: defineFiltersSchema({
                mapping: { aliasId: 'id' },
                allowed: ['id'],
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );
    });

    it('should not parse with non matching name', async () => {
        // filter wrong allowed
        const output = parser.parse({ id: 1 }, {
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
        const output = parser.parse({ 'id!': 1 }, {
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
        const output = parser.parse({ 'id!': 1 }, {
            schema: defineFiltersSchema({
                allowed: ['id!'],
            }),
        });

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id!', 1),
                ],
            ),
        );
    });

    it('should not parse empty input', async () => {
        const output = parser.parse({ name: '' }, {
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
        let output = parser.parse({ name: null });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'name', null),
                ],
            ),
        );

        output = parser.parse({ name: 'null' });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'name', null),
                ],
            ),
        );
    });

    it('should not parse empty object', async () => {
        const output = parser.parse({});
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [],
            ),
        );
    });

    it('should parse with default', async () => {
        let output = parser.parse({ id: 1 }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
                ],
            ),
        );

        output = parser.parse({ name: 'tada5hi' }, {
            schema: defineFiltersSchema({
                default: { name: 'admin' },
            }),
        });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'tada5hi'),
                ],
            ),
        );
    });

    it('should parse with default path', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id', 'display_name'],
            name: 'user',
        });

        let output = parser.parse({ id: 1 }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );

        output = parser.parse({ display_name: 'admin' }, { schema }); expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'display_name', 'admin'),
                ],
            ),
        );
    });

    it('should parse with validator', async () => {
        let output = await parser.parseAsync(
            { id: '1' },
            {
                schema: defineFiltersSchema({
                    allowed: ['id'],
                    validate: (condition) => {
                        if (
                            condition.operator === FilterFieldOperator.EQUAL &&
                            condition.field === 'id' &&
                            typeof condition.value !== 'number'
                        ) {
                            throw new Error('Attribute id must be of type number.');
                        }
                    },
                }),
            },
        );

        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );

        output = await parser.parseAsync(
            { id: '1,2,3' },
            {
                schema: defineFiltersSchema({
                    allowed: ['id'],
                    validate: (condition) => {
                        if (
                            condition.operator === FilterFieldOperator.IN ||
                            condition.operator === FilterFieldOperator.NOT_IN
                        ) {
                            const value = (condition.value as unknown[])
                                .filter((el) => typeof el === 'number' && el > 1);

                            return new Filter(
                                condition.operator,
                                condition.field,
                                value,
                            );
                        }

                        if (condition.field === 'id') {
                            if (typeof condition.value !== 'number' || condition.value <= 1) {
                                throw new Error('Field id must be of type number and greater than 1');
                            }
                        }

                        return undefined;
                    },
                }),
            },
        );
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.IN, 'id', [2, 3]),
                ],
            ),
        );
    });

    it('should parse with different number input', async () => {
        const schema = defineFiltersSchema({
            allowed: ['id'],
        });

        // equal operator
        let output = parser.parse({ id: '1' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ],
            ),
        );

        // negation with equal operator
        output = parser.parse({ id: '!1' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.NOT_EQUAL, 'id', 1),
                ],
            ),
        );

        // in operator
        output = parser.parse({ id: 'null,0,1,2,3' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.IN, 'id', [null, 0, 1, 2, 3]),
                ],
            ),
        );

        // negation with in operator
        output = parser.parse({ id: '!1,2,3' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.NOT_IN, 'id', [1, 2, 3]),
                ],
            ),
        );

        // less than operator
        output = parser.parse({ id: '<10' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.LESS_THAN, 'id', 10),
                ],
            ),
        );

        // less than equal operator
        output = parser.parse({ id: '<=10' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'id', 10),
                ],
            ),
        );

        // more than operator
        output = parser.parse({ id: '>10' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.GREATER_THAN, 'id', 10),
                ],
            ),
        );

        // more than equal operator
        output = parser.parse({ id: '>=10' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'id', 10),
                ],
            ),
        );
    });

    it('should parse different string inputs', async () => {
        const schema = defineFiltersSchema({
            allowed: ['name'],
        });

        // like operator (start)
        let output = parser.parse({ name: '~name' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex('name', FilterRegexFlag.STARTS_WITH),
                    ),
                ],
            ),
        );

        // like operator (end)
        output = parser.parse({ name: 'name~' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex('name', FilterRegexFlag.ENDS_WITH),
                    ),
                ],
            ),
        );

        // like operator (start & end)
        output = parser.parse({ name: '~name~' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex('name', FilterRegexFlag.STARTS_WITH | FilterRegexFlag.ENDS_WITH),
                    ),
                ],
            ),
        );

        // negation + like operator (start)
        output = parser.parse({ name: '!~name' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex('name', FilterRegexFlag.STARTS_WITH | FilterRegexFlag.NEGATION),
                    ),
                ],
            ),
        );

        // negation + like operator (end)
        output = parser.parse({ name: '!name~' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex('name', FilterRegexFlag.ENDS_WITH | FilterRegexFlag.NEGATION),
                    ),
                ],
            ),
        );

        // negation + like operator (start & end)
        output = parser.parse({ name: '!~name~' }, { schema });
        expect(output).toEqual(
            new Filters(
                FilterCompoundOperator.AND,
                [
                    new Filter(
                        FilterFieldOperator.REGEX,
                        'name',
                        createFilterRegex(
                            'name',
                            FilterRegexFlag.STARTS_WITH |
                            FilterRegexFlag.ENDS_WITH |
                            FilterRegexFlag.NEGATION,
                        ),
                    ),
                ],
            ),
        );
    });

    fit('should parse with includes', async () => {
        // simple
        let output = parser.parse({ id: 1, 'realm.id': 2 }, {
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
        output = parser.parse({ id: 1, 'realm.id': 3 }, { schema: 'user' });
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
        output = parser.parse({ id: 1, 'realm.item.id': 4 }, { schema: 'user' });
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

        await expect(parser.parse('foo', { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key value', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyValueInvalid('foo');

        await expect(parser.parse({
            foo: Buffer.from('foo'),
        }, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
        });

        const error = FiltersParseError.keyInvalid('1foo');

        await expect(parser.parse({
            '1foo': 1,
        }, { schema })).rejects.toThrow(error);
    });

    it('should throw on non allowed relation', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['user.foo'],
        });

        const error = FiltersParseError.keyPathInvalid('bar');

        await expect(parser.parse({
            'bar.bar': 1,
        }, {
            schema,
            relations: new Relations([
                new Relation('user'),
            ]),
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed key which is not covered by a relation', async () => {
        const error = FiltersParseError.keyInvalid('bar');

        await expect(parser.parse({
            'realm.bar': 1,
        }, {
            schema: 'user',
            relations: new Relations([
                new Relation('realm'),
            ]),
            throwOnFailure: true,
        })).rejects.toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineFiltersSchema({
            throwOnFailure: true,
            allowed: ['foo'],
        });

        const error = FiltersParseError.keyInvalid('bar');

        await expect(parser.parse({
            bar: 1,
        }, { schema })).rejects.toThrow(error);
    });
});
