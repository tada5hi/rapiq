/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    buildFieldDomainRecords,
    DEFAULT_ID,
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

        // fields undefined with default
        data = parseQueryFields(undefined, {...options, default: ['id']});
        expect(data).toEqual([{ key: 'id' }]);

        // fields as array
        data = parseQueryFields(['id'], options);
        expect(data).toEqual([{ key: 'id' }] as FieldsParseOutput);

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

        // undefined allowed -> allows nothing
        data = parseQueryFields('id', { ...options, allowed: undefined });
        expect(data).toEqual([] as FieldsParseOutput);

        // field not allowed
        data = parseQueryFields('avatar', options);
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        // field with invalid value
        data = parseQueryFields({ id: null }, options);
        expect(data).toEqual([{ key: 'id' }, { key: 'name' }] as FieldsParseOutput);

        // if only one domain is given, try to parse request field to single domain.
        data = parseQueryFields(['id'], { allowed: { domain: ['id'] } });
        expect(data).toEqual([{ path: 'domain', key: 'id' }] as FieldsParseOutput);

        // if multiple possibilities are available for request field, use allowed
        data = parseQueryFields(['id'], { allowed: { domain: ['id', 'name'], domain2: ['id', 'name'] } });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain', key: 'name' },
            { path: 'domain2', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);

        // if multiple possibilities are available for request field, use default
        data = parseQueryFields<Record<string, any>>(['id'], {
            allowed: { domain: ['id', 'name'], domain2: ['id', 'name'] },
            default: { domain: ['id'], domain2: ['name']}
        });
        expect(data).toEqual([
            { path: 'domain', key: 'id' },
            { path: 'domain2', key: 'name' },
        ] as FieldsParseOutput);
    });

    it('should transform fields with defaults', () => {
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
            allowed: ['id'],
            mapping: {
                path: 'id'
            }
        });
        expect(data).toEqual([
            {key: 'id'}
        ] as FieldsParseOutput);

        data = parseQueryFields('+alias', {
            allowed: ['id'],
            mapping: {
                alias: 'id'
            }
        })
        expect(data).toEqual([
            { key: 'id'}
        ] as FieldsParseOutput);
    })

    it('should transform fields with includes', () => {
        const includes = parseQueryRelations(['profile', 'roles'], { allowed: ['user', 'profile'] });

        // simple domain match
        let data = parseQueryFields({ profile: ['id'] }, { allowed: { profile: ['id'] }, relations: includes });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);

        // only single domain match
        data = parseQueryFields({ profile: ['id'], permissions: ['id'] }, { allowed: { profile: ['id'], permissions: ['id'] }, relations: includes });
        expect(data).toEqual([{ path: 'profile', key: 'id' }] as FieldsParseOutput);
    });
});