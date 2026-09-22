/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Query } from '@rapiq/core';
import {
    Adapter,
    mssql,
    mysql,
    oracle,
    pg,
    resolveDialect,
    sqlite,
} from '../../src';

describe('src/dialect/resolve.ts', () => {
    it.each([
        ['postgres', pg],
        ['postgresql', pg],
        ['cockroachdb', pg],
        ['aurora-postgres', pg],
        ['mysql', mysql],
        ['mysql2', mysql],
        ['mariadb', mysql],
        ['aurora-mysql', mysql],
        ['sqlite', sqlite],
        ['better-sqlite3', sqlite],
        ['sqljs', sqlite],
        ['mssql', mssql],
        ['oracle', oracle],
    ])('should resolve %s', (name, preset) => {
        expect(resolveDialect(name)).toBe(preset);
    });

    it('should resolve case-insensitively', () => {
        expect(resolveDialect('MySQL')).toBe(mysql);
    });

    it('should not resolve unknown names', () => {
        expect(resolveDialect('mongodb')).toBeUndefined();
        expect(resolveDialect('spanner')).toBeUndefined();
    });
});


describe('identifier escaping (#941)', () => {
    it.each([
        [pg, 'name") is not null or true or ("name', '"name"") is not null or true or (""name"'],
        [oracle, 'a"b', '"a""b"'],
        [mysql, 'a`b', '`a``b`'],
        [sqlite, 'a`b', '`a``b`'],
        [mssql, 'a]b', '[a]]b]'],
    ] as const)('should keep the whole input inside one identifier: %s', (dialect, input, quoted) => {
        expect(dialect.escapeField(input)).toBe(quoted);
        for (const operator of ['eq', 'contains'] as const) {
            const adapter = new Adapter(dialect);
            adapter.execute(new Query({ filters: new Filter(operator, input, 'zz') }));
            expect(adapter.filters.getQuery()).toContain(quoted);
            expect(adapter.filters.params).toEqual([operator === 'eq' ? 'zz' : '%zz%']);
        }
    });
});
