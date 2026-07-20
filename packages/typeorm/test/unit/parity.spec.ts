/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '@rapiq/core';
import {
    AdapterError,
    FILTER_OPERATOR_SEMANTICS,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    ITSELF,
    Query,
    isFilters,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { Role } from '../data/entity/role';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';
import { createRoleSeed } from '../data/seeder/role';
import { createUserSeed } from '../data/seeder/user';

/**
 * Plain-object mirror of the database seed — the same records the
 * sqlite backend queries, evaluated by @rapiq/memory. The parity
 * contract: the same condition selects the same rows on every
 * backend ("one IR, same meaning everywhere").
 */
const FIXTURES = [
    {
        id: 1,
        first_name: 'Caleb',
        last_name: 'Barrows',
        age: 18,
        address: 'Hogwarts',
        email: 'caleb.barrows@gmail.com',
        nickName: null,
        realm: null,
    },
    {
        id: 2,
        first_name: 'Aston',
        last_name: 'Nel',
        age: 60,
        address: null,
        email: 'ashton.nel@gmail.com',
        nickName: 'Ash',
        realm: { name: 'master' },
    },
];

type ParityCase = {
    operator: string,
    label: string,
    condition: ICondition,
    /**
     * ids expected from BOTH backends — computed by hand from the
     * fixtures, so the suite asserts documented semantics rather
     * than echoing either implementation.
     */
    expected: number[],
    /**
     * The sql/typeorm backend declares this condition unsupported:
     * assert the typed error instead of row parity. Memory still
     * must produce `expected`.
     */
    sqlThrows?: boolean,
};

const CASES : ParityCase[] = [
    {
        operator: 'eq',
        label: 'eq folds string case by default',
        condition: new Filter(FilterFieldOperator.EQUAL, 'first_name', 'CALEB'),
        expected: [1],
    },
    {
        operator: 'eq',
        label: 'eq(null) is a null test',
        condition: new Filter(FilterFieldOperator.EQUAL, 'nickName', null),
        expected: [1],
    },
    {
        operator: 'ne',
        label: 'ne matches null values (complement law)',
        condition: new Filter(FilterFieldOperator.NOT_EQUAL, 'nickName', 'Ash'),
        expected: [1],
    },
    {
        operator: 'ne',
        label: 'ne(null) is a not-null test',
        condition: new Filter(FilterFieldOperator.NOT_EQUAL, 'nickName', null),
        expected: [2],
    },
    {
        operator: 'lt',
        label: 'lt',
        condition: new Filter(FilterFieldOperator.LESS_THAN, 'age', 60),
        expected: [1],
    },
    {
        operator: 'lte',
        label: 'lte',
        condition: new Filter(FilterFieldOperator.LESS_THAN_EQUAL, 'age', 60),
        expected: [1, 2],
    },
    {
        operator: 'gt',
        label: 'gt',
        condition: new Filter(FilterFieldOperator.GREATER_THAN, 'age', 18),
        expected: [2],
    },
    {
        operator: 'gte',
        label: 'gte',
        condition: new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 60),
        expected: [2],
    },
    {
        operator: 'in',
        label: 'in with a null member also matches absence',
        condition: new Filter(FilterFieldOperator.IN, 'nickName', ['Ash', null]),
        expected: [1, 2],
    },
    {
        operator: 'in',
        label: 'in([]) matches nothing',
        condition: new Filter(FilterFieldOperator.IN, 'age', []),
        expected: [],
    },
    {
        operator: 'nin',
        label: 'nin with a null member excludes absence',
        condition: new Filter(FilterFieldOperator.NOT_IN, 'nickName', ['Ash', null]),
        expected: [],
    },
    {
        operator: 'nin',
        label: 'nin matches null values (complement law)',
        condition: new Filter(FilterFieldOperator.NOT_IN, 'nickName', ['Ash']),
        expected: [1],
    },
    {
        operator: 'startsWith',
        label: 'startsWith is case-insensitive',
        condition: new Filter(FilterFieldOperator.STARTS_WITH, 'first_name', 'cal'),
        expected: [1],
    },
    {
        operator: 'notStartsWith',
        label: 'notStartsWith',
        condition: new Filter(FilterFieldOperator.NOT_STARTS_WITH, 'first_name', 'Cal'),
        expected: [2],
    },
    {
        operator: 'endsWith',
        label: 'endsWith is case-insensitive',
        condition: new Filter(FilterFieldOperator.ENDS_WITH, 'email', 'GMAIL.COM'),
        expected: [1, 2],
    },
    {
        operator: 'notEndsWith',
        label: 'notEndsWith',
        condition: new Filter(FilterFieldOperator.NOT_ENDS_WITH, 'email', '@gmail.com'),
        expected: [],
    },
    {
        operator: 'contains',
        label: 'contains never matches null values',
        condition: new Filter(FilterFieldOperator.CONTAINS, 'address', 'warts'),
        expected: [1],
    },
    {
        operator: 'notContains',
        label: 'notContains matches null values (complement law)',
        condition: new Filter(FilterFieldOperator.NOT_CONTAINS, 'address', 'warts'),
        expected: [2],
    },
    {
        operator: 'regex',
        label: 'regex is declared unsupported on regexp-less dialects',
        condition: new Filter(FilterFieldOperator.REGEX, 'last_name', /nel$/i),
        expected: [2],
        sqlThrows: true,
    },
    {
        operator: 'mod',
        label: 'mod',
        condition: new Filter(FilterFieldOperator.MOD, 'age', [2, 0]),
        expected: [1, 2],
    },
    {
        operator: 'mod',
        label: 'an invalid mod value matches nothing everywhere',
        condition: new Filter(FilterFieldOperator.MOD, 'age', [0, 1]),
        expected: [],
    },
    {
        operator: 'size',
        label: 'size is declared unsupported without array columns',
        condition: new Filter(FilterFieldOperator.SIZE, 'age', 1),
        expected: [],
        sqlThrows: true,
    },
    {
        operator: 'exists',
        label: 'exists(true)',
        condition: new Filter(FilterFieldOperator.EXISTS, 'nickName', true),
        expected: [2],
    },
    {
        operator: 'exists',
        label: 'exists(false)',
        condition: new Filter(FilterFieldOperator.EXISTS, 'nickName', false),
        expected: [1],
    },
    {
        operator: 'elemMatch',
        label: 'elemMatch binds join rows and objects alike',
        condition: new Filter(
            FilterFieldOperator.ELEM_MATCH,
            'realm',
            new Filter(FilterFieldOperator.EQUAL, 'name', 'master'),
        ),
        expected: [2],
    },
    {
        operator: 'elemMatch',
        label: 'ITSELF is declared unsupported on scalar columns',
        condition: new Filter(
            FilterFieldOperator.ELEM_MATCH,
            'scores',
            new Filter(FilterFieldOperator.GREATER_THAN, ITSELF, 5),
        ),
        expected: [],
        sqlThrows: true,
    },
    {
        operator: 'and',
        label: 'compound and',
        condition: new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.GREATER_THAN, 'age', 10),
            new Filter(FilterFieldOperator.EQUAL, 'first_name', 'Aston'),
        ]),
        expected: [2],
    },
    {
        operator: 'or',
        label: 'compound or',
        condition: new Filters(FilterCompoundOperator.OR, [
            new Filter(FilterFieldOperator.EQUAL, 'age', 18),
            new Filter(FilterFieldOperator.EQUAL, 'age', 60),
        ]),
        expected: [1, 2],
    },
    {
        operator: 'nor',
        label: 'compound nor (plain boolean not)',
        condition: new Filters('nor', [
            new Filter(FilterFieldOperator.EQUAL, 'age', 18),
            new Filter(FilterFieldOperator.GREATER_THAN, 'age', 50),
        ]),
        expected: [],
    },
    {
        operator: 'not',
        label: 'compound not (plain boolean not)',
        condition: new Filters('not', [
            new Filter(FilterFieldOperator.GREATER_THAN, 'age', 50),
        ]),
        expected: [1],
    },
];

describe('cross-backend operator parity', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);

        const [admin] = await createRoleSeed(dataSource);
        const roleRepository = dataSource.getRepository(Role);
        admin.realm = master;
        await roleRepository.save(admin);

        const [, aston] = await createUserSeed(dataSource);
        const userRepository = dataSource.getRepository(User);
        aston.role = admin;
        aston.realm = master;

        await userRepository.save(aston);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const applyTypeorm = async (condition: ICondition) : Promise<number[]> => {
        const repository = dataSource.getRepository(User);
        const queryBuilder = repository.createQueryBuilder('user');

        const filters = isFilters(condition) ?
            condition :
            new Filters(FilterCompoundOperator.AND, [condition]);

        const adapter = new TypeormAdapter({ queryBuilder });
        adapter.execute(new Query({ filters: filters as Filters }));

        const data = await queryBuilder.getMany();

        return data.map((row) => row.id).sort();
    };

    const applyMemory = (condition: ICondition) : number[] => {
        const predicate = compileFilters(condition as Filter | Filters);

        return FIXTURES
            .filter((row) => predicate(row))
            .map((row) => row.id)
            .sort();
    };

    it('should enroll every operator of the semantics table', () => {
        const covered = new Set(CASES.map((entry) => entry.operator));

        for (const operator of Object.keys(FILTER_OPERATOR_SEMANTICS)) {
            expect(covered, `operator ${operator} has no parity case`)
                .toContain(operator);
        }
    });

    for (const entry of CASES) {
        it(`${entry.operator}: ${entry.label}`, async () => {
            expect(applyMemory(entry.condition)).toEqual(entry.expected);

            if (entry.sqlThrows) {
                await expect(applyTypeorm(entry.condition))
                    .rejects.toThrowError(AdapterError);

                return;
            }

            expect(await applyTypeorm(entry.condition)).toEqual(entry.expected);
        });
    }
});
