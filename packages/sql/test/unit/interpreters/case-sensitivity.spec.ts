/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter } from '@rapiq/core';
import {
    FiltersAdapter,
    type FiltersContainerOptions,
    FiltersVisitor,
    RelationsAdapter,
    mysql,
    pg,
} from '../../../src';

const createAdapter = (options: FiltersContainerOptions) => new FiltersAdapter(
    new RelationsAdapter(),
    options,
);

describe('equality case sensitivity', () => {
    it('folds string equality through lower() by default', () => {
        const adapter = createAdapter({ ...pg });
        new Filter('eq', 'name', 'John').accept(new FiltersVisitor(adapter));

        expect(adapter.getQueryAndParameters()).toEqual([
            'lower("name") = lower($1)',
            ['John'],
        ]);
    });

    it('keeps fields listed in caseSensitive exact', () => {
        const adapter = createAdapter({ ...pg });
        const visitor = new FiltersVisitor(adapter, { caseSensitive: ['id'] });
        new Filter('eq', 'id', 'aBc').accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '"id" = $1',
            ['aBc'],
        ]);
    });

    it('keeps caseSensitive in-lists exact', () => {
        const adapter = createAdapter({ ...pg });
        const visitor = new FiltersVisitor(adapter, { caseSensitive: ['id'] });
        new Filter('in', 'id', ['a', 'b']).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '"id" in($1, $2)',
            ['a', 'b'],
        ]);
    });

    it('folds only the string members of a mixed in-list', () => {
        const adapter = createAdapter({ ...pg });
        new Filter('in', 'code', ['a', 1]).accept(new FiltersVisitor(adapter));

        expect(adapter.getQueryAndParameters()).toEqual([
            'lower("code") in(lower($1), $2)',
            ['a', 1],
        ]);
    });

    it('emits plain comparisons when the dialect caseFold is identity (mysql)', () => {
        const adapter = createAdapter({ ...mysql });
        new Filter('eq', 'name', 'John').accept(new FiltersVisitor(adapter));

        expect(adapter.getQueryAndParameters()).toEqual([
            '`name` = ?',
            ['John'],
        ]);
    });
});
