/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, RelationsAdapter, exists, pg,
} from '../../../src';
import { FiltersInterpreter } from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('exists', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: { exists },
    });

    it('generates query with `is not null` operator when value equals `true`', () => {
        const condition = new FieldCondition('exists', 'address', true);

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} is not null`);
        expect(params).toEqual([]);
    });

    it('generates query with `is null` operator when value equals `false`', () => {
        const condition = new FieldCondition('exists', 'address', false);

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} is null`);
        expect(params).toEqual([]);
    });
});
