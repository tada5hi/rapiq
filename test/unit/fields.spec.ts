/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    buildFieldDomainRecords,
    DEFAULT_ID,
    FieldsParseError,
    FieldsParseOptions,
    FieldsParseOutput,
    parseQueryFields,
    parseQueryRelations,
} from '../../src';

describe('src/fields/index.ts', () => {
    it('should transform allowed domain fields', () => {
        const fields : string[] = ['id', 'name'];

        let transformedFields = buildFieldDomainRecords(fields);
        expect(transformedFields).toEqual({ [DEFAULT_ID]: fields });

        transformedFields = buildFieldDomainRecords({ domain: fields });
        expect(transformedFields).toEqual({ domain: fields });

        transformedFields = buildFieldDomainRecords({});
        expect(transformedFields).toEqual({});
    });

    it('should transform fields with defaultPath', () => {
        let options : FieldsParseOptions = {
            allowed: ['id', 'name', 'email'],
            defaultPath: 'user'
        };

        let data = parseQueryFields([], options);
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user'
            },
            {
                key: 'name',
                path: 'user'
            },
            {
                key: 'email',
                path: 'user'
            }
        ] as FieldsParseOutput);

        data = parseQueryFields('+email', options);
        expect(data).toEqual([
            {
                key: 'email',
                path: 'user'
            }
        ] as FieldsParseOutput);

        options = {
            allowed: [
                ['id', 'name', 'email'],
                {
                    domain: ['extra']
                }
            ],
            defaultPath: 'user'
        }

        data = parseQueryFields('+email', options);
        expect(data).toEqual([
            {
                key: 'email',
                path: 'user'
            },
            {
                key: 'extra',
                path: 'domain'
            }
        ] as FieldsParseOutput);

        data = parseQueryFields('+extra', options);
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user'
            },
            {
                key: 'name',
                path: 'user'
            },
            {
                key: 'email',
                path: 'user'
            },
            {
                key: 'extra',
                path: 'domain'
            },
        ]);

        data = parseQueryFields({
            domain: '+extra'
        }, options);
        expect(data).toEqual([
            {
                key: 'id',
                path: 'user'
            },
            {
                key: 'name',
                path: 'user'
            },
            {
                key: 'email',
                path: 'user'
            },
            {
                key: 'extra',
                path: 'domain'
            }
        ] as FieldsParseOutput);
    })

    it('should transform fields', () => {
        const options : FieldsParseOptions = {
            allowed: ['id', 'name'],
        };

        // fields undefined
        let data = parseQueryFields(undefined, options);
        expect(data).toEqual([{key: 'id'}, {key: 'name'}]);

        data = parseQueryFields('name', { default: ['id']});
        expect(data).toEqual([{ key: 'id' }]);

        // fields undefined with default
        data = parseQueryFields(undefined, {...options, default: ['id']});
        expect(data).toEqual([{ key: 'id' }]);

        // fields as array
        data = parseQueryFields(['id'], options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // no options
        data = parseQueryFields(['id']);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // invalid field names
        data = parseQueryFields(['"id', 'name!']);
        expect(data).toEqual([] as FieldsParseOutput);

        // ignore field name pattern, if permitted by allowed key
        data = parseQueryFields(['name!'], { allowed: ['name!'] });
        expect(data).toEqual([{key: 'name!'}] as FieldsParseOutput);

        // empty allowed -> allows nothing
        data = parseQueryFields(['id'], {allowed: []});
        expect(data).toEqual([] as FieldsParseOutput);

        // empty default -> allows nothing
        data = parseQueryFields(['id'], {default: []});
        expect(data).toEqual([] as FieldsParseOutput);

        // fields as string
        data = parseQueryFields('id', options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // multiple fields but only one valid field
        data = parseQueryFields(['id', 'avatar'], options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // field as string and append fields
        data = parseQueryFields('+id', options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parseQueryFields('avatar,+id', options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parseQueryFields('-id', options);
        expect(data).toEqual([{ key: 'name' }] as FieldsParseOutput);

        // fields as string and append fields
        data = parseQueryFields('id,+name', options);
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        // empty allowed -> allows nothing
        data = parseQueryFields('id', { ...options, allowed: [] });
        expect(data).toEqual([] as FieldsParseOutput);

        // undefined allowed -> allows everything
        data = parseQueryFields('id', { ...options, allowed: undefined });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        // field not allowed
        data = parseQueryFields('avatar', options);
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        // field with invalid value
        data = parseQueryFields({ id: null }, options);
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);
    });

    it('should parse with single allowed domain', () => {
        // if only one domain is given, try to parse request field to single domain.
        const data = parseQueryFields(['id'], { allowed: { domain: ['id'] } });
        expect(data).toEqual([{ path: 'domain', key: 'id' }] as FieldsParseOutput);
    });

    it('should parse with multiple allowed domains', () => {
        // if multiple possibilities are available for request field, use allowed
        const data = parseQueryFields(['id'], {
            allowed: {
                domain: ['id', 'name'],
                domain2: ['id', 'name']
            }
        });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain2', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should use default fields if default & allowed are set', () => {
        // if multiple possibilities are available for request field, use default
        const data = parseQueryFields<Record<string, any>>(['id'], {
            allowed: { domain: ['id', 'name'], domain2: ['id', 'name'] },
            default: { domain: ['id'], domain2: ['name']}
        });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);
    })

    it('should parse with defaults', () => {
        let data = parseQueryFields([], { default: ['id', 'name'] });
        expect(data).toEqual([{ key: 'id' }, { key: 'name'}] as FieldsParseOutput);

        data = parseQueryFields(['id'], { default: ['id', 'name'] });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parseQueryFields(['fake'], { default: ['id', 'name'] });
        expect(data).toEqual([{ key: 'id' }, { key: 'name'}] as FieldsParseOutput);

        data = parseQueryFields(['id'], { default: ['name'], allowed: ['id' ] });
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

        data = parseQueryFields(['+id'], { default: ['name'], allowed:  ['id' ] });
        expect(data).toEqual([{key: 'name'}, { key: 'id' }] as FieldsParseOutput);

        data = parseQueryFields([], { default: ['name'] , allowed: ['id' ] });
        expect(data).toEqual([{ key: 'name' }] as FieldsParseOutput);
    })

    it('should transform fields with aliasMapping', () => {
        let data = parseQueryFields('+alias', {
            allowed: ['id', 'name'],
            mapping: {
                path: 'id'
            }
        });
        expect(data).toEqual([
            {key: 'id'},
            {key: 'name'}
        ] as FieldsParseOutput);

        data = parseQueryFields('+alias', {
            allowed: ['id', 'name'],
            mapping: {
                alias: 'id'
            }
        })
        expect(data).toEqual([
            { key: 'id'}
        ] as FieldsParseOutput);
    })

    it('should parse with includes', () => {
        const includes = parseQueryRelations(['profile', 'roles'], { allowed: ['user', 'profile'] });

        // simple domain match
        let data = parseQueryFields({ profile: ['id'] }, { allowed: { profile: ['id'] }, relations: includes });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);

        // only single domain match
        data = parseQueryFields({ profile: ['id'], permissions: ['id'] }, { allowed: { profile: ['id'], permissions: ['id'] }, relations: includes });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);
    });

    it('should throw on invalid input shape', () => {
        let options : FieldsParseOptions = {
            throwOnFailure: true
        }

        let error = FieldsParseError.inputInvalid();
        let evaluate = () => {
            parseQueryFields(false, options);
        }
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed relation', () => {
        let options : FieldsParseOptions = {
            throwOnFailure: true,
            allowed: ['user.foo'],
            relations: [
                {
                    key: 'user',
                    value: 'user'
                }
            ]
        }

        let error = FieldsParseError.keyPathInvalid('bar');
        let evaluate = () => {
            parseQueryFields({
                'bar': ['bar']
            }, options);
        }
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key', () => {
        let options : FieldsParseOptions = {
            throwOnFailure: true
        };

        let t = () => {
            return parseQueryFields(['!.bar'], options)
        }

        expect(t).toThrow(FieldsParseError);

        options.allowed = ['id', 'name', 'email'];
        options.defaultPath = 'user';

        t = () => {
            return parseQueryFields(['baz'], options)
        }

        expect(t).toThrow(FieldsParseError);
    })
});
