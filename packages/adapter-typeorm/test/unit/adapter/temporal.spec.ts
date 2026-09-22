/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../../src';
import { Reading } from '../../data/entity/reading';
import { User } from '../../data/entity/user';
import { createUnconnectedDataSource } from '../../data/factory';

describe('src/adapter/filters.ts (temporalKind)', () => {
    let sqlite : DataSource;
    let pg : DataSource;

    beforeAll(async () => {
        sqlite = await createUnconnectedDataSource();
        pg = await createUnconnectedDataSource({
            type: 'postgres',
            database: 'test',
            entities: [Reading],
        });
    });

    const forReading = () => new TypeormAdapter({ queryBuilder: pg.getRepository(Reading).createQueryBuilder('reading') });

    const forUser = () => new TypeormAdapter({ queryBuilder: sqlite.getRepository(User).createQueryBuilder('user') });

    it('should read a zone-aware column as an instant', () => {
        expect(forReading().filters.temporalKind('observed_at')).toEqual('instant');
    });

    it('should read a zone-less column as a wall clock', () => {
        expect(forReading().filters.temporalKind('recorded_at')).toEqual('datetime');
        expect(forUser().filters.temporalKind('created_at')).toEqual('datetime');
    });

    it('should read a date-only column as a calendar day', () => {
        expect(forReading().filters.temporalKind('observed_on')).toEqual('date');
        expect(forUser().filters.temporalKind('birth_date')).toEqual('date');
    });

    it('should answer undefined for a column that is not temporal', () => {
        expect(forReading().filters.temporalKind('value')).toBeUndefined();
        expect(forUser().filters.temporalKind('age')).toBeUndefined();
    });

    it('should fall back to a wall clock without entity metadata', () => {
        const queryBuilder = sqlite
            .createQueryBuilder()
            .select('t.at')
            .from('some_table', 't');

        const adapter = new TypeormAdapter({ queryBuilder });

        expect(adapter.filters.temporalKind('at')).toEqual('datetime');
    });
});
