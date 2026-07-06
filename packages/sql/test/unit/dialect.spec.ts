/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
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
