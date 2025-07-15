/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    URLParameter, and, filters, or,
} from '../../../src';
import { serializeAsURI } from '../../../src/utils';
import type { Entity } from '../../data';

describe('builder/filters', () => {
    describe('basic', () => {
        it('should build filter with number value input', () => {
            const record = filters<Entity>({
                id: 1,
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: 1 } }));
        });

        it('should build filter with null value input', () => {
            const record = filters<Entity>({
                id: null,
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: null } }));
        });

        it('should build filter with undefined value input', () => {
            const record = filters<Entity>({
                id: undefined,
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: null } }));
        });

        it('should build filter with nested input', () => {
            let record = filters<Entity>({
                child: {
                    id: 1,
                },
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { 'child.id': 1 } }));

            record = filters<Entity>({
                'child.id': 1,
                child: {
                    'child.id': 'abc',
                },
            });
            expect(record.build()).toEqual(serializeAsURI({
                [URLParameter.FILTERS]: {
                    'child.id': 1,
                    'child.child.id': 'abc',
                },
            }));

            record = filters<Entity>({
                siblings: {
                    id: 1,
                },
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { 'siblings.id': 1 } }));
        });

        it('should filter with value operator', () => {
            let record = filters<Entity>({
                id: '!1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '!1' } }));

            record = filters<Entity>({
                id: '~1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '~1' } }));

            // with lessThan
            record = filters<Entity>({
                id: '<1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '<1' } }));

            // with lessThanEqual
            record = filters<Entity>({
                id: '<=1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '<=1' } }));

            // with moreThan
            record = filters<Entity>({
                id: '>1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '>1' } }));

            // with moreThanEqual
            record = filters<Entity>({
                id: '>=1',
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '>=1' } }));

            // with negation & in operator
            record = filters<Entity>({
                id: [null, 1, 2, 3],
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: 'null,1,2,3' } }));

            // with negation & like operator
            record = filters<Entity>({
                id: ['!~1', 2, 3],
            });
            expect(record.build()).toEqual(serializeAsURI({ [URLParameter.FILTERS]: { id: '!~1,2,3' } }));
        });
    });

    describe('compound', () => {
        it('should work with compound and input', () => {
            const data = filters<Entity>({
                operator: 'and',
                value: [
                    {
                        id: 1,
                    },
                    {
                        name: 'foo',
                    },
                ],
            });

            expect(data.normalize()).toEqual({
                id: '1',
                name: 'foo',
            });
        });

        it('should work with compound and input', () => {
            const data = filters<Entity>({
                operator: 'or',
                value: [
                    {
                        id: 1,
                    },
                    {
                        name: 'foo',
                    },
                ],
            });

            expect(data.normalize()).toEqual({
                '0:id': '1',
                '1:name': 'foo',
            });
        });

        it('should work with nested compound input', () => {
            const data = filters<Entity>({
                operator: 'or',
                value: [
                    {
                        operator: 'and',
                        value: [
                            {
                                id: 1,
                            }, {
                                name: 'foo',
                            },
                        ],
                    },
                    {
                        name: 'bar',
                    },
                ],
            });

            expect(data.normalize()).toEqual({
                '0:id': '1',
                '0:name': 'foo',
                '1:name': 'bar',
            });
        });
    });

    describe('grouped', () => {
        it('should build simple and group', () => {
            const group = and([
                filters<Entity>({
                    id: 1,
                }),
                filters<Entity>({
                    name: 'foo',
                }),
            ]);

            expect(group.normalize()).toEqual({
                id: '1',
                name: 'foo',
            });
        });

        it('should build or group (level 0)', () => {
            const group = or([
                filters<Entity>({
                    id: 1,
                }),
                filters<Entity>({
                    name: 'foo',
                }),
            ]);

            expect(group.normalize()).toEqual({
                '0:id': '1',
                '1:name': 'foo',
            });
        });

        it('should build or(or(),_)', () => {
            const group = or([
                or([
                    filters<Entity>({
                        id: 1,
                    }),
                    filters<Entity>({
                        name: 'foo',
                    }),
                ]),
                filters<Entity>({
                    'child.age': '<15',
                }),
            ]);

            expect(group.normalize()).toEqual({
                '0:id': '1',
                '1:name': 'foo',
                '2:child.age': '<15',
            });
        });

        it('should build or(and(),_)', () => {
            const group = or([
                and([
                    filters<Entity>({
                        id: 1,
                    }),
                    filters<Entity>({
                        name: 'foo',
                    }),
                ]),
                filters<Entity>({
                    'child.age': '<15',
                }),
            ]);

            expect(group.normalize()).toEqual({
                '0:id': '1',
                '0:name': 'foo',
                '1:child.age': '<15',
            });
        });

        it('should build and(and(),_)', () => {
            const group = and([
                and([
                    filters<Entity>({
                        id: 1,
                    }),
                    filters<Entity>({
                        name: 'foo',
                    }),
                ]),
                filters<Entity>({
                    'child.age': '<15',
                }),
            ]);

            expect(group.normalize()).toEqual({
                id: '1',
                name: 'foo',
                'child.age': '<15',
            });
        });

        it('should build and(or(),_)', () => {
            const group = and([
                or([
                    filters<Entity>({
                        id: 1,
                    }),
                    filters<Entity>({
                        name: 'foo',
                    }),
                ]),
                filters<Entity>({
                    'child.age': '<15',
                }),
            ]);

            expect(group.normalize()).toEqual({
                '0:id': '1',
                '1:name': 'foo',
                'child.age': '<15',
            });
        });

        it('should build and(or(or()),_)', () => {
            const group = or([
                and([
                    filters<Entity>({
                        id: 1,
                    }),
                    or([
                        filters<Entity>({
                            name: 'foo',
                        }),
                        filters<Entity>({
                            name: 'bar',
                        }),
                    ]),
                ]),

                filters<Entity>({
                    id: 15,
                }),
            ]);

            expect(group.normalize()).toEqual({
                '0:id': '1',
                '000:name': 'foo',
                '001:name': 'bar',
                '1:id': '15',
            });
        });
    });
});
